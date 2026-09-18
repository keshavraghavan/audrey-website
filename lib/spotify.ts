// Server-only Spotify Web API helpers. Never import this from a Client
// Component — it reads SPOTIFY_CLIENT_SECRET.

export type SpotifySearchResult = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
};

let cachedAppToken: { accessToken: string; expiresAt: number } | null = null;

/**
 * The deployment never got its Spotify env vars. Distinct from the errors
 * below because no amount of retrying fixes it — it needs env vars and a
 * redeploy, and the UI should say so rather than "try again in a moment".
 */
export class SpotifyNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpotifyNotConfiguredError";
  }
}

type SpotifyStep = "token" | "search" | "me" | "create-playlist" | "add-tracks";

/**
 * Spotify answered and rejected us. `step` matters for diagnosis: a failure at
 * "token" means our client credentials were refused, while the same status at
 * "search" means the credentials were fine and Spotify refused the call —
 * completely different fixes.
 */
export class SpotifyRequestError extends Error {
  constructor(
    readonly step: SpotifyStep,
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Spotify ${step} failed: ${status}${detail ? ` — ${detail}` : ""}`);
    this.name = "SpotifyRequestError";
  }
}

// Spotify puts the actual reason in the response body — `invalid_client` for a
// bad secret, an allowlist or scope message behind a 403. Dropping it left
// every failure as a bare status code in the logs, which is exactly what made
// these hard to tell apart.
async function requestError(step: SpotifyStep, res: Response): Promise<SpotifyRequestError> {
  const detail = await res
    .text()
    .then((body) => body.slice(0, 300))
    .catch(() => "");
  return new SpotifyRequestError(step, res.status, detail);
}

function requireClientCredentials(): { clientId: string; clientSecret: string } {
  // Trimmed because these get pasted by hand into a hosting dashboard, where a
  // trailing newline rides along and comes back as an `invalid_client`
  // rejection that looks nothing like a whitespace problem.
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new SpotifyNotConfiguredError("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

function requireRedirectUri(): string {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (!redirectUri) {
    throw new SpotifyNotConfiguredError("SPOTIFY_REDIRECT_URI is not set");
  }
  return redirectUri;
}

async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return cachedAppToken.accessToken;
  }
  const { clientId, clientSecret } = requireClientCredentials();
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw await requestError("token", res);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAppToken = {
    accessToken: data.access_token,
    // Refresh a minute early so a search never races an expiring token.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedAppToken.accessToken;
}

type SpotifyApiTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

function mapTrack(t: SpotifyApiTrack): SpotifySearchResult {
  return {
    id: t.id,
    uri: t.uri,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    albumArtUrl: t.album.images[0]?.url ?? null,
  };
}

export async function searchTracks(query: string): Promise<SpotifySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "8");

  let res = await fetch(url, { headers: { Authorization: `Bearer ${await getAppAccessToken()}` } });
  if (res.status === 401) {
    // The cached token outlived its real lifetime — a serverless instance can
    // stay warm across a Spotify-side invalidation. Drop it and try once with
    // a fresh one rather than failing a search the visitor can't retry into.
    cachedAppToken = null;
    res = await fetch(url, { headers: { Authorization: `Bearer ${await getAppAccessToken()}` } });
  }
  if (!res.ok) {
    throw await requestError("search", res);
  }
  const data = (await res.json()) as { tracks: { items: SpotifyApiTrack[] } };
  return data.tracks.items.map(mapTrack);
}

export type SpotifyUserTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function basicAuthHeader(): string {
  const { clientId, clientSecret } = requireClientCredentials();
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function getAuthorizeUrl(state: string): string {
  const { clientId } = requireClientCredentials();
  const redirectUri = requireRedirectUri();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "playlist-modify-public playlist-modify-private");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyUserTokens> {
  const redirectUri = requireRedirectUri();
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    throw await requestError("token", res);
  }
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    throw await requestError("token", res);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };
}

export async function getSpotifyUserId(accessToken: string): Promise<string> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw await requestError("me", res);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function createPlaylist(accessToken: string, userId: string, name: string): Promise<string> {
  const res = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, public: false, description: "Songs friends added — from the birthday site" }),
  });
  if (!res.ok) {
    throw await requestError("create-playlist", res);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function addTracksToPlaylist(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: chunk }),
    });
    if (!res.ok) {
      throw await requestError("add-tracks", res);
    }
  }
}
