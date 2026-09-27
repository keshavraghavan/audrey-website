// Server-only Spotify Web API helpers. Never import this from a Client
// Component — it reads SPOTIFY_CLIENT_SECRET.

import { readEnv } from "@/lib/env";

export type SpotifySearchResult = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
};

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

type SpotifyStep = "app-token" | "user-token" | "search" | "create-playlist" | "add-tracks";

/**
 * Spotify answered and rejected us. `step` matters for diagnosis:
 * - "app-token": the client-credentials grant. A 400/401 here means our client
 *   ID/secret were refused; anything else is Spotify's accounts service having
 *   a bad moment.
 * - "user-token": exchanging an OAuth code or refreshing the owner's token. A
 *   400 here is usually `invalid_grant` — the owner revoked access or the code
 *   expired — not a bad secret.
 * - everything else: the token was accepted and Spotify refused the call itself.
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

/** Spotify refused our client credentials (wrong or rotated secret). */
export function isCredentialRejection(err: unknown): boolean {
  return err instanceof SpotifyRequestError && err.step === "app-token" && (err.status === 400 || err.status === 401);
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
  const clientId = readEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = readEnv("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new SpotifyNotConfiguredError("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

function requireRedirectUri(): string {
  const redirectUri = readEnv("SPOTIFY_REDIRECT_URI");
  if (!redirectUri) {
    throw new SpotifyNotConfiguredError("SPOTIFY_REDIRECT_URI is not set");
  }
  return redirectUri;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string };

// Every grant goes through the same endpoint with the same Basic auth; only the
// form params and which step to blame differ.
async function postToken(step: "app-token" | "user-token", params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireClientCredentials();
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    throw await requestError(step, res);
  }
  return (await res.json()) as TokenResponse;
}

type AppToken = { accessToken: string; expiresAt: number };

let cachedAppToken: AppToken | null = null;
// Shared so concurrent searches on a warm instance wait on one token request
// instead of each fetching (and overwriting) their own.
let pendingAppToken: Promise<AppToken> | null = null;

async function getAppAccessToken(): Promise<{ accessToken: string; fresh: boolean }> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return { accessToken: cachedAppToken.accessToken, fresh: false };
  }
  pendingAppToken ??= postToken("app-token", { grant_type: "client_credentials" })
    .then((data) => {
      cachedAppToken = {
        accessToken: data.access_token,
        // Refresh a minute early so a search never races an expiring token.
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };
      return cachedAppToken;
    })
    .finally(() => {
      pendingAppToken = null;
    });
  return { accessToken: (await pendingAppToken).accessToken, fresh: true };
}

// Only drop the cache if it still holds the token that was rejected — another
// request may already have replaced it with a good one.
function invalidateAppToken(rejected: string): void {
  if (cachedAppToken?.accessToken === rejected) {
    cachedAppToken = null;
  }
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

  const token = await getAppAccessToken();
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
  if (res.status === 401 && !token.fresh) {
    // The cached token outlived its real lifetime — a serverless instance can
    // stay warm across a Spotify-side invalidation. Drop it and try once with
    // a fresh one rather than failing a search the visitor can't retry into.
    // A token we fetched moments ago getting a 401 won't be fixed by another.
    await res.body?.cancel();
    invalidateAppToken(token.accessToken);
    const retry = await getAppAccessToken();
    res = await fetch(url, { headers: { Authorization: `Bearer ${retry.accessToken}` } });
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
  const data = await postToken("user-token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: requireRedirectUri(),
  });
  return { accessToken: data.access_token, refreshToken: data.refresh_token!, expiresIn: data.expires_in };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const data = await postToken("user-token", { grant_type: "refresh_token", refresh_token: refreshToken });
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  };
}

// Spotify's February 2026 Web API changes removed POST /users/{id}/playlists
// and renamed /playlists/{id}/tracks to /items; the old paths return 403 for
// every app. Don't switch back to them when chasing a 403 — check the owner is
// on the app's user allowlist instead.
export async function createPlaylist(accessToken: string, name: string): Promise<string> {
  const res = await fetch("https://api.spotify.com/v1/me/playlists", {
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

/** Spotify's cap on URIs per add-items request. */
export const PLAYLIST_ADD_LIMIT = 100;

export async function addTracksToPlaylist(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  if (uris.length > PLAYLIST_ADD_LIMIT) {
    throw new Error(`addTracksToPlaylist takes at most ${PLAYLIST_ADD_LIMIT} URIs; chunk them first`);
  }
  const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    throw await requestError("add-tracks", res);
  }
}
