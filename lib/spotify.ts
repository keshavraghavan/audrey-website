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

function requireClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
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
    throw new Error(`Spotify app token request failed: ${res.status}`);
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
  const token = await getAppAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
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
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("SPOTIFY_REDIRECT_URI is not set");
  }
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "playlist-modify-public playlist-modify-private");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyUserTokens> {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("SPOTIFY_REDIRECT_URI is not set");
  }
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
    throw new Error(`Spotify token exchange failed: ${res.status}`);
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
    throw new Error(`Spotify token refresh failed: ${res.status}`);
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
    throw new Error(`Spotify /me failed: ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function createPlaylist(accessToken: string, userId: string, name: string): Promise<string> {
  const res = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, public: false, description: "Songs friends added — from the birthday site" }),
  });
  if (!res.ok) {
    throw new Error(`Spotify create playlist failed: ${res.status}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function addTracksToPlaylist(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: chunk }),
    });
    if (!res.ok) {
      throw new Error(`Spotify add tracks failed: ${res.status}`);
    }
  }
}
