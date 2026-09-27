import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tracks, spotifyConnection } from "@/lib/db/schema";
import {
  exchangeCodeForTokens,
  createPlaylist,
  addTracksToPlaylist,
  PLAYLIST_ADD_LIMIT,
  SpotifyNotConfiguredError,
} from "@/lib/spotify";
import { NAME } from "@/lib/audrey-data";

const STATE_COOKIE = "spotify_oauth_state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "invalid or expired connect request" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const db = getDb();
    const existing = (await db.select().from(spotifyConnection).limit(1))[0];

    let playlistId = existing?.playlistId ?? null;
    if (!playlistId) {
      playlistId = await createPlaylist(tokens.accessToken, `${NAME}'s Birthday Mix`);
    }

    if (existing) {
      await db
        .update(spotifyConnection)
        .set({ refreshToken: tokens.refreshToken, playlistId })
        .where(eq(spotifyConnection.id, existing.id));
    } else {
      await db.insert(spotifyConnection).values({ refreshToken: tokens.refreshToken, playlistId });
    }

    // Mark each chunk synced as soon as Spotify accepts it, so a failure
    // partway through only leaves the unpushed chunks for the next reconnect
    // instead of re-adding (and duplicating) everything already on the playlist.
    const unsynced = await db.select().from(tracks).where(isNull(tracks.syncedAt));
    for (let i = 0; i < unsynced.length; i += PLAYLIST_ADD_LIMIT) {
      const chunk = unsynced.slice(i, i + PLAYLIST_ADD_LIMIT);
      await addTracksToPlaylist(
        tokens.accessToken,
        playlistId,
        chunk.map((t) => t.spotifyUri),
      );
      await db
        .update(tracks)
        .set({ syncedAt: new Date() })
        .where(inArray(tracks.id, chunk.map((t) => t.id)));
    }

    return NextResponse.redirect(new URL(`/connect-spotify?status=connected&count=${unsynced.length}`, request.url));
  } catch (err) {
    console.error("Spotify callback failed:", err);
    if (err instanceof SpotifyNotConfiguredError) {
      // Retrying won't help — the deployment needs its env vars and a redeploy.
      return NextResponse.json({ error: "Spotify isn't configured on this deployment" }, { status: 503 });
    }
    return NextResponse.json({ error: "connect failed — try again" }, { status: 500 });
  }
}
