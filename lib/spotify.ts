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
