import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tracks, spotifyConnection } from "@/lib/db/schema";
import { exchangeCodeForTokens, getSpotifyUserId, createPlaylist, addTracksToPlaylist } from "@/lib/spotify";
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
    // Confirms the account is registered for this app and the token is valid
    // before we start writing anything — a clearer failure than the create
    // playlist error below.
    await getSpotifyUserId(tokens.accessToken);

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

    const unsynced = await db.select().from(tracks).where(isNull(tracks.syncedAt));
    if (unsynced.length > 0) {
      await addTracksToPlaylist(
        tokens.accessToken,
        playlistId,
        unsynced.map((t) => t.spotifyUri),
      );
      for (const t of unsynced) {
        await db.update(tracks).set({ syncedAt: new Date() }).where(eq(tracks.id, t.id));
      }
    }

    return NextResponse.redirect(new URL(`/connect-spotify?status=connected&count=${unsynced.length}`, request.url));
  } catch (err) {
    console.error("Spotify callback failed:", err);
    return NextResponse.json({ error: "connect failed — try again" }, { status: 500 });
  }
}
