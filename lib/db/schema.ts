import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  spotifyId: text("spotify_id").notNull().unique(),
  spotifyUri: text("spotify_uri").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  albumArtUrl: text("album_art_url"),
  addedBy: text("added_by").notNull(),
  // Set once this row has been pushed to Audrey's real Spotify playlist.
  // Purely for observability — nothing reads it to drive behavior yet.
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrackRow = typeof tracks.$inferSelect;
export type NewTrackRow = typeof tracks.$inferInsert;

// Only ever holds one row in practice (there's a single target account),
// but it's a table rather than a hardcoded singleton so reconnecting is
// just an upsert, not a schema change.
export const spotifyConnection = pgTable("spotify_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  refreshToken: text("refresh_token").notNull(),
  playlistId: text("playlist_id"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpotifyConnectionRow = typeof spotifyConnection.$inferSelect;
