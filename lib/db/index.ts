import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { tracks, spotifyConnection, type TrackRow, type SpotifyConnectionRow } from "./schema";

let db: ReturnType<typeof drizzle> | null = null;

// Lazy singleton — must not call neon() at module load time. That reads
// process.env.DATABASE_URL immediately, which would throw during
// `next build` before env vars are guaranteed to exist.
export function getDb() {
  if (!db) {
    db = drizzle(neon(process.env.DATABASE_URL!));
  }
  return db;
}

export async function getTracks(): Promise<TrackRow[]> {
  return getDb().select().from(tracks).orderBy(desc(tracks.createdAt));
}

export async function getSpotifyConnection(): Promise<SpotifyConnectionRow | null> {
  const rows = await getDb().select().from(spotifyConnection).limit(1);
  return rows[0] ?? null;
}
