"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { tracks } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthorizeUrl } from "@/lib/spotify";

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

    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    console.error("addTrackToMix failed:", err);
    return { ok: false, error: "Couldn't save that — try again in a moment." };
  }
}

const STATE_COOKIE = "spotify_oauth_state";

function passphraseMatches(input: string): boolean {
  const expected = process.env.CONNECT_PASSPHRASE ?? "";
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
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
