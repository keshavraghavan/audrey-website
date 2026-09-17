"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { tracks } from "@/lib/db/schema";

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
