"use server";

import { revalidatePath } from "next/cache";
import { getDb, getSpotifyConnection } from "@/lib/db";
import { tracks, spotifyConnection, guestbookMessages } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthorizeUrl, refreshAccessToken, addTracksToPlaylist } from "@/lib/spotify";
import { eq, sql } from "drizzle-orm";
import { toGuestbookMessage, type GuestbookMessage } from "@/lib/audrey-data";

const ALLOWED_BLOB_HOSTNAME = "9dg6oaslwkgdoppo.public.blob.vercel-storage.com";

function isAllowedPhotoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === ALLOWED_BLOB_HOSTNAME;
  } catch {
    return false;
  }
}

export type AddTrackInput = {
  spotifyId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  addedBy: string;
};

export type AddTrackResult = { ok: true; duplicate?: boolean } | { ok: false; error: string };

export async function addTrackToMix(input: AddTrackInput): Promise<AddTrackResult> {
  const addedBy = input.addedBy.trim();
  if (!addedBy) {
    return { ok: false, error: "Need a name before we can add it." };
  }
  if (!input.spotifyId || !input.spotifyUri || !input.title || !input.artist) {
    return { ok: false, error: "Pick a song from the search results first." };
  }

  try {
    const inserted = await getDb()
      .insert(tracks)
      .values({
        spotifyId: input.spotifyId,
        spotifyUri: input.spotifyUri,
        title: input.title,
        artist: input.artist,
        albumArtUrl: input.albumArtUrl,
        addedBy,
      })
      .onConflictDoNothing({ target: tracks.spotifyId })
      .returning({ id: tracks.id });

    if (inserted.length === 0) {
      return { ok: true, duplicate: true };
    }

    try {
      const connection = await getSpotifyConnection();
      if (connection?.playlistId) {
        const { accessToken, refreshToken } = await refreshAccessToken(connection.refreshToken);
        await addTracksToPlaylist(accessToken, connection.playlistId, [input.spotifyUri]);
        if (refreshToken) {
          await getDb().update(spotifyConnection).set({ refreshToken }).where(eq(spotifyConnection.id, connection.id));
        }
        await getDb().update(tracks).set({ syncedAt: new Date() }).where(eq(tracks.id, inserted[0].id));
      }
    } catch (err) {
      // Non-blocking: the track is already safely saved locally even if
      // the live push to her real playlist fails (revoked token, Spotify
      // outage, Neon connection error, etc.) — logged only, never surfaced to the visitor.
      console.error("Live sync to Spotify playlist failed:", err);
    }

    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    console.error("addTrackToMix failed:", err);
    return { ok: false, error: "Couldn't save that — try again in a moment." };
  }
}

const STATE_COOKIE = "spotify_oauth_state";

function passphraseMatches(input: string): boolean {
  const expected = process.env.CONNECT_PASSPHRASE;
  if (!expected || expected.length < 8) return false; // fail closed when unconfigured
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function connectSpotify(passphrase: string): Promise<{ ok: false; error: string } | void> {
  if (!passphraseMatches(passphrase)) {
    return { ok: false, error: "That's not the right passphrase." };
  }
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  redirect(getAuthorizeUrl(state));
}

export type PostGuestbookMessageInput = {
  name: string;
  body: string;
  photoUrls: string[];
};

export type PostGuestbookMessageResult = { ok: true; message: GuestbookMessage } | { ok: false; error: string };

export async function postGuestbookMessage(input: PostGuestbookMessageInput): Promise<PostGuestbookMessageResult> {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) {
    return { ok: false, error: "Need a name and a note before we can post it." };
  }
  if (name.length > 100 || body.length > 2000) {
    return { ok: false, error: "That's a bit long — try trimming it down." };
  }

  try {
    const photoUrls = input.photoUrls.slice(0, 3).filter(isAllowedPhotoUrl);
    const [row] = await getDb()
      .insert(guestbookMessages)
      .values({ name, body, photoUrls })
      .returning();
    revalidatePath("/");
    return { ok: true, message: toGuestbookMessage(row) };
  } catch (err) {
    console.error("postGuestbookMessage failed:", err);
    return { ok: false, error: "Couldn't post that — try again in a moment." };
  }
}

export async function toggleGuestbookLike(id: string, liked: boolean): Promise<void> {
  try {
    await getDb()
      .update(guestbookMessages)
      .set({ likes: sql`${guestbookMessages.likes} + ${liked ? 1 : -1}` })
      .where(eq(guestbookMessages.id, id));
    revalidatePath("/");
  } catch (err) {
    console.error("toggleGuestbookLike failed:", err);
  }
}
