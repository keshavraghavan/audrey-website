# Spotify-Search Sounds Playlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sounds tab's manual song/artist text entry with a live Spotify search, store every visitor's pick in a real shared Postgres database, and let Audrey connect her own Spotify account once to get a real, auto-syncing playlist.

**Architecture:** Neon Postgres (via Drizzle) becomes the source of truth for the playlist, read server-side in `app/page.tsx` and passed into the existing client component tree. A Route Handler proxies Spotify search (Client Credentials); a Server Action inserts new tracks and — once Audrey has connected — pushes them live to her real playlist. A separate, unlisted, passphrase-gated page drives the one-time OAuth connect + playlist creation, handled by a second Route Handler as the callback target.

**Tech Stack:** Next.js 16.3.0 App Router, Drizzle ORM (`drizzle-orm/neon-http`) + `@neondatabase/serverless`, Spotify Web API (Client Credentials + Authorization Code flows), React 19 (`useActionState`).

**Spec:** `docs/superpowers/specs/2026-09-13-spotify-sounds-design.md`

## Global Constraints

- Track entry is Spotify-search-only — no manual title/artist text fields (spec: "Decisions locked in").
- The real Spotify playlist is created **private** (spec: "Decisions locked in").
- OAuth uses the plain Authorization Code flow, no PKCE — the client secret lives only in server env vars (spec: "Decisions locked in").
- A failed live-sync-to-real-playlist call never blocks or fails a local add — logged only (spec: "Data flow examples" / "Error handling").
- `/connect-spotify` is not linked from nav and is gated by the `CONNECT_PASSPHRASE` env var (spec: "Decisions locked in").
- No test runner is introduced. Verification is manual against real Spotify/Neon, plus small throwaway `tsx` scripts for pure-logic checks (spec: "Testing").
- Guestbook, album/photo uploads, and the admin panel are out of scope — untouched by this plan (spec: "Decisions locked in" / "Out of scope").
- `SEED_PLAYLIST` and `SONG_PALETTES` are removed; the mix starts empty (spec: "Decisions locked in").

---

## Task 1: Provision environment & secrets

**This is a human step — do not delegate it to a coding subagent.** It requires creating accounts/apps and cannot be done from a terminal alone. Whoever runs this plan should complete it themselves before handing Task 2 onward to an implementer.

**Files:**
- Create: `.env.local` (gitignored, real secrets)
- Create: `.env.example` (committed, documents the keys with no values)
- Modify: `.gitignore`

**Interfaces:**
- Produces: the five env var names every later task reads — `DATABASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `CONNECT_PASSPHRASE`.

- [ ] **Step 1: Provision a Neon Postgres database**

Go to https://console.neon.tech, create a project (any name/region), open its **Connection Details**, and copy the pooled connection string (starts `postgresql://`). This is `DATABASE_URL`. (If this repo later gets linked to Vercel, the Neon Marketplace integration produces the same shape of value — either source works.)

- [ ] **Step 2: Create a fresh Spotify Developer app**

Go to https://developer.spotify.com/dashboard, click **Create app**. Name/description can be anything (e.g. "Audrey Birthday Mix"). Under **Redirect URIs**, add exactly:

```
http://127.0.0.1:3000/api/spotify/callback
```

Spotify requires the loopback IP form for local development — `http://localhost:3000/...` will be rejected. Save. On the app's **Settings** page, copy the **Client ID**, then click **View client secret** to reveal `SPOTIFY_CLIENT_SECRET`.

- [ ] **Step 3: Pick a passphrase**

Choose any string for `CONNECT_PASSPHRASE` — this gates the one-time `/connect-spotify` page later. Anything memorable and not publicly guessable is fine; this is a low-stakes gate, not a security boundary.

- [ ] **Step 4: Write `.env.local`**

Create `.env.local` in the repo root:

```
DATABASE_URL=postgresql://<your-neon-connection-string>
SPOTIFY_CLIENT_ID=<your-client-id>
SPOTIFY_CLIENT_SECRET=<your-client-secret>
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
CONNECT_PASSPHRASE=<your-chosen-passphrase>
```

- [ ] **Step 5: Allow `.env.example` past the `.gitignore` blanket rule**

The repo's `.gitignore` has a blanket `.env*` rule, which would also swallow the committed example file. Add a negation line right after it:

```gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

- [ ] **Step 6: Create the committed `.env.example`**

```
DATABASE_URL=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
CONNECT_PASSPHRASE=
```

- [ ] **Step 7: Verify the env vars load**

Run:

```bash
npx dotenv -e .env.local -- node -e "['DATABASE_URL','SPOTIFY_CLIENT_ID','SPOTIFY_CLIENT_SECRET','SPOTIFY_REDIRECT_URI','CONNECT_PASSPHRASE'].forEach(k => console.log(k, !!process.env[k]))"
```

Expected: all five lines print `true`.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .env.example
git commit -m "chore: document required env vars for Spotify sounds feature"
```

(`.env.local` is never committed — it's covered by the existing `.env*` ignore rule.)

---

## Task 2: Database bootstrap — schema, client, migration

**Files:**
- Create: `drizzle.config.ts`
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `process.env.DATABASE_URL` (from Task 1).
- Produces: `getDb()`, `getTracks(): Promise<TrackRow[]>`, `getSpotifyConnection(): Promise<SpotifyConnectionRow | null>` from `@/lib/db`; `tracks`, `spotifyConnection` tables and `TrackRow`, `NewTrackRow`, `SpotifyConnectionRow` types from `@/lib/db/schema` — every later task reads/writes through these.

- [ ] **Step 1: Write the Drizzle schema**

```ts
// lib/db/schema.ts
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
```

- [ ] **Step 2: Write the Drizzle client**

```ts
// lib/db/index.ts
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
```

- [ ] **Step 3: Write the Drizzle Kit config**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Add DB scripts to `package.json`**

Add these two entries to the `"scripts"` object (alongside the existing `dev`/`build`/`start`/`lint`):

```json
    "db:push": "dotenv -e .env.local -- drizzle-kit push",
    "db:studio": "dotenv -e .env.local -- drizzle-kit studio"
```

- [ ] **Step 5: Push the schema to Neon**

```bash
npm run db:push
```

Expected: drizzle-kit reports it created the `tracks` and `spotify_connection` tables (it may ask to confirm creating new tables — accept).

- [ ] **Step 6: Verify with a round-trip insert/select**

Create a throwaway verification script:

```ts
// scripts/_verify-db.ts
import { eq } from "drizzle-orm";
import { getDb, getTracks } from "../lib/db";
import { tracks } from "../lib/db/schema";

async function main() {
  await getDb().insert(tracks).values({
    spotifyId: "verify-track-1",
    spotifyUri: "spotify:track:verify-track-1",
    title: "Verify Track",
    artist: "Verify Artist",
    addedBy: "setup-script",
  });
  const rows = await getTracks();
  console.log("track count:", rows.length);
  console.log("first row title:", rows[0]?.title);
  await getDb().delete(tracks).where(eq(tracks.spotifyId, "verify-track-1"));
  console.log("cleanup done");
}

main();
```

Run:

```bash
npx dotenv -e .env.local -- npx tsx scripts/_verify-db.ts
```

Expected output:

```
track count: 1
first row title: Verify Track
cleanup done
```

Then delete the throwaway script:

```bash
rm scripts/_verify-db.ts
```

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts lib/db package.json package-lock.json
git commit -m "feat: add Drizzle schema and client for tracks + spotify_connection"
```

---

## Task 3: Spotify search helper + search Route Handler

**Files:**
- Create: `lib/spotify.ts`
- Create: `app/api/spotify/search/route.ts`

**Interfaces:**
- Consumes: `process.env.SPOTIFY_CLIENT_ID`, `process.env.SPOTIFY_CLIENT_SECRET` (from Task 1).
- Produces: `SpotifySearchResult` type and `searchTracks(query: string): Promise<SpotifySearchResult[]>` from `@/lib/spotify` — consumed by the search route here and by `SoundsTab.tsx` (as a type) in Task 4.

- [ ] **Step 1: Write the app-token + search helper**

```ts
// lib/spotify.ts
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
```

- [ ] **Step 2: Write the search Route Handler**

```ts
// app/api/spotify/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchTracks(q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Spotify search error:", err);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify against the real Spotify API**

In one terminal:

```bash
npx dotenv -e .env.local -- npm run dev
```

In another, once it's up:

```bash
curl -s "http://127.0.0.1:3000/api/spotify/search?q=paper%20bag"
```

Expected: a JSON array of up to 8 objects shaped `{ id, uri, title, artist, albumArtUrl }`, including one titled "Paper Bag" by "Fiona Apple". Also check the empty-query short-circuit:

```bash
curl -s "http://127.0.0.1:3000/api/spotify/search?q=a"
```

Expected: `[]` (query too short, no Spotify call made). Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts app/api/spotify/search
git commit -m "feat: proxy Spotify track search through a Route Handler"
```

---

## Task 4: Real shared playlist — search UI + add-to-mix action

This is the core user-facing milestone: friends can search Spotify, pick a track, and add it to a mix that's genuinely shared across every visitor.

**Files:**
- Modify: `lib/audrey-data.ts`
- Create: `app/actions.ts`
- Modify: `app/page.tsx`
- Modify: `components/AudreySite.tsx`
- Modify: `components/tabs/SoundsTab.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `getDb()`, `getTracks()` from `@/lib/db` (Task 2); `SpotifySearchResult` type from `@/lib/spotify` (Task 3); `/api/spotify/search` (Task 3).
- Produces: `Track` type (redefined) from `@/lib/audrey-data`; `AddTrackInput`, `AddTrackResult`, `addTrackToMix(input: AddTrackInput): Promise<AddTrackResult>` from `@/app/actions` — Task 8 extends this same function without changing its signature.

- [ ] **Step 1: Update the `Track` type and remove dead seed data**

In `lib/audrey-data.ts`, these two edits are **not contiguous** — `ALBUM`, `BAR_HEIGHTS`, and `BAR_COLORS` sit between them and must stay untouched.

First, replace the `Track` type and `SEED_PLAYLIST` array (currently lines 67–80, right after `SEED_MESSAGES`'s closing `];`):

```ts
export type Track = {
  title: string;
  artist: string;
  by: string;
  colors: [string, string];
};

export const SEED_PLAYLIST: Track[] = [
  { title: "Paper Bag", artist: "Fiona Apple", by: "Priya", colors: ["#ff8ec9", "#c800a8"] },
  { title: "Belinda Says", artist: "Alvvays", by: "Jules", colors: ["#7de3e3", "#009a9a"] },
  { title: "Basketball Shoes", artist: "Black Country, New Road", by: "Marcus", colors: ["#ffe680", "#ffb300"] },
  { title: "Simulation Swarm", artist: "Big Thief", by: "Mom", colors: ["#c9a7ff", "#7a4dff"] },
  { title: "Birthday Song", artist: "Sun Ra", by: "Dad", colors: ["#ff6a3d", "#a8330f"] },
];
```

with:

```ts
export type Track = {
  id: string;
  spotifyId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  addedBy: string;
};
```

Second, remove the `SONG_PALETTES` array further down (currently lines 101–106, between `BAR_COLORS` and `NAME`):

```ts
export const SONG_PALETTES: [string, string][] = [
  ["#ff8ec9", "#c800a8"],
  ["#7de3e3", "#009a9a"],
  ["#ffe680", "#ffb300"],
  ["#c9a7ff", "#7a4dff"],
];
```

Delete it entirely (blank line before `NAME` is fine to leave as-is). Leave everything else in the file untouched (`TABS`, `SEED_MESSAGES`, `GuestbookMessage`, `ALBUM`, `AlbumPhoto`, `BAR_HEIGHTS`, `BAR_COLORS`, `NAME`, `AGE`, `ACCENT`, `BIRTHDAY`).

- [ ] **Step 2: Write the `addTrackToMix` Server Action**

```ts
// app/actions.ts
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
```

(Task 8 adds a live-sync-to-real-playlist block into this function between the duplicate check and `revalidatePath` — the signature and both return shapes above stay exactly as written here.)

- [ ] **Step 3: Make `app/page.tsx` async and fetch the real playlist**

```tsx
// app/page.tsx
import AudreySite from "@/components/AudreySite";
import { getTracks } from "@/lib/db";

export default async function Page() {
  let tracks: Awaited<ReturnType<typeof getTracks>> = [];
  try {
    tracks = await getTracks();
  } catch (err) {
    console.error("Failed to load tracks:", err);
  }
  return <AudreySite initialTracks={tracks} />;
}
```

- [ ] **Step 4: Allow Spotify's album art domain in `next.config.ts`**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.scdn.co" }],
  },
};

export default nextConfig;
```

- [ ] **Step 5: Rework `components/AudreySite.tsx`'s playlist state**

Change the import block (drop `SEED_PLAYLIST` and `SONG_PALETTES`, add the new action and type):

```tsx
import { addTrackToMix } from "@/app/actions";
import type { SpotifySearchResult } from "@/lib/spotify";
import {
  ACCENT,
  AGE,
  BIRTHDAY,
  NAME,
  SEED_MESSAGES,
  TABS,
  type GuestbookMessage,
  type Tab,
  type Track,
} from "@/lib/audrey-data";
```

Add the `initialTracks` prop and drop `playlist` from the persisted-to-`localStorage` shape (it's server-backed now, not client-persisted):

```tsx
type SavedState = {
  messages?: GuestbookMessage[];
  liked?: Record<string, boolean>;
};

export default function AudreySite({ initialTracks }: { initialTracks: Track[] }) {
  const [tab, setTab] = useState<Tab>("home");
  const [messages, setMessages] = useState<GuestbookMessage[]>(SEED_MESSAGES);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [playlist, setPlaylist] = useState<Track[]>(initialTracks);
  const [hydrated, setHydrated] = useState(false);

  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedTrack, setSelectedTrack] = useState<SpotifySearchResult | null>(null);
  const [songBy, setSongBy] = useState("");
  const [soundsNotice, setSoundsNotice] = useState("");

  const [daysToGo, setDaysToGo] = useState<number | null>(null);
```

Update the hydrate effect to stop touching `playlist` (it now only ever comes from the server prop):

```tsx
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    document.documentElement.style.setProperty("--accent", ACCENT);
    setDaysToGo(Math.max(0, Math.ceil((BIRTHDAY.getTime() - Date.now()) / 86400000)));
    try {
      const saved: SavedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.messages?.length) setMessages(saved.messages);
      if (saved.liked) setLiked(saved.liked);
    } catch {
      // Corrupt or unavailable storage — carry on with the seed content.
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, liked }));
    } catch {
      // Storage full or disabled — the session still works, it just won't persist.
    }
  }, [messages, liked, hydrated]);
```

Replace the old `addSong` callback entirely:

```tsx
  const addSong = useCallback(async () => {
    if (!selectedTrack) {
      setSoundsNotice("Pick a song from the search results first.");
      return;
    }
    const addedBy = songBy.trim() || "anonymous";
    const result = await addTrackToMix({
      spotifyId: selectedTrack.id,
      spotifyUri: selectedTrack.uri,
      title: selectedTrack.title,
      artist: selectedTrack.artist,
      albumArtUrl: selectedTrack.albumArtUrl,
      addedBy,
    });
    if (!result.ok) {
      setSoundsNotice(result.error);
      return;
    }
    if (result.duplicate) {
      setSoundsNotice("Already on the mix!");
      return;
    }
    setPlaylist((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        spotifyId: selectedTrack.id,
        spotifyUri: selectedTrack.uri,
        title: selectedTrack.title,
        artist: selectedTrack.artist,
        albumArtUrl: selectedTrack.albumArtUrl,
        addedBy,
      },
    ]);
    setSelectedTrack(null);
    setSongBy("");
    setSoundsNotice("Added to the mix!");
  }, [selectedTrack, songBy]);
```

Update the `SoundsTab` render call:

```tsx
          {tab === "sounds" && (
            <SoundsTab
              playlist={playlist}
              songBy={songBy}
              onSongByChange={setSongBy}
              selectedTrack={selectedTrack}
              onSelectTrack={setSelectedTrack}
              onClearSelectedTrack={() => setSelectedTrack(null)}
              notice={soundsNotice}
              onAddSong={addSong}
            />
          )}
```

- [ ] **Step 6: Rewrite `components/tabs/SoundsTab.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Track } from "@/lib/audrey-data";
import type { SpotifySearchResult } from "@/lib/spotify";

const inputStyle = {
  border: "none",
  borderRadius: 999,
  background: "#fbf8f8",
  boxShadow: "inset 0 0 0 1px #bfe6e6",
  padding: "10px 14px",
  fontSize: 12,
  color: "#4a3341",
};

function SongSearch({
  selectedTrack,
  onSelectTrack,
  onClearSelectedTrack,
}: {
  selectedTrack: SpotifySearchResult | null;
  onSelectTrack: (track: SpotifySearchResult) => void;
  onClearSelectedTrack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError("");
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("search failed");
          return res.json() as Promise<SpotifySearchResult[]>;
        })
        .then((data) => {
          setResults(data);
          setSearchError("");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setSearchError("Couldn't search right now — try again in a moment.");
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (selectedTrack) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 999,
          background: "#fbf8f8",
          boxShadow: "inset 0 0 0 1px #bfe6e6",
          padding: "6px 8px 6px 14px",
        }}
      >
        <div style={{ flex: 1, fontSize: 12, color: "#4a3341" }}>
          <strong>{selectedTrack.title}</strong> — {selectedTrack.artist}
        </div>
        <button
          onClick={onClearSelectedTrack}
          aria-label="Clear selected song"
          style={{
            border: "none",
            background: "#e7d3de",
            color: "#7a0048",
            borderRadius: "50%",
            width: 22,
            height: 22,
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search for a song…"
        style={inputStyle}
      />
      {searchError && <div style={{ marginTop: 6, fontSize: 11, color: "#a3005e" }}>{searchError}</div>}
      {results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
            overflow: "hidden",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onSelectTrack(r);
                setQuery("");
                setResults([]);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                border: "none",
                background: "none",
                padding: "8px 12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {r.albumArtUrl ? (
                <Image src={r.albumArtUrl} alt="" width={32} height={32} style={{ borderRadius: 5, flex: "none" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 5, flex: "none", background: "#eef0f0" }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#7a0048",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#8a5875",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.artist}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SoundsTab({
  playlist,
  songBy,
  onSongByChange,
  selectedTrack,
  onSelectTrack,
  onClearSelectedTrack,
  notice,
  onAddSong,
}: {
  playlist: Track[];
  songBy: string;
  onSongByChange: (value: string) => void;
  selectedTrack: SpotifySearchResult | null;
  onSelectTrack: (track: SpotifySearchResult) => void;
  onClearSelectedTrack: () => void;
  notice: string;
  onAddSong: () => void;
}) {
  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <div style={{ maxWidth: 480 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-archivo-black)",
            fontSize: 30,
            color: "#00a3a3",
            letterSpacing: "-0.025em",
          }}
        >
          THE BIRTHDAY MIX
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>
          {playlist.length} songs, added by us. Put something on it.
        </p>
        <div
          style={{
            marginTop: 20,
            borderRadius: 14,
            background: "#fbf7f7",
            boxShadow: "0 3px 0 #cfe9e9, 0 10px 22px rgba(0,92,92,0.1)",
            overflow: "hidden",
          }}
        >
          {playlist.map((t) => (
            <div
              key={t.id}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #eef0f0" }}
            >
              {t.albumArtUrl ? (
                <Image src={t.albumArtUrl} alt="" width={34} height={34} style={{ borderRadius: 7, flex: "none" }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: 7, flex: "none", background: "#eef0f0" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>{t.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: "#9c6d89", textAlign: "right" }}>
                added by
                <br />
                <span style={{ color: "var(--accent-dark)", fontWeight: 700 }}>{t.addedBy}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: 14, background: "#eff7f7", display: "flex", flexDirection: "column", gap: 9 }}>
            <SongSearch selectedTrack={selectedTrack} onSelectTrack={onSelectTrack} onClearSelectedTrack={onClearSelectedTrack} />
            <input
              value={songBy}
              onChange={(e) => onSongByChange(e.target.value)}
              placeholder="your name"
              style={inputStyle}
            />
            <button
              onClick={onAddSong}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#005c5c",
                background: "linear-gradient(#e3f4f4, #7de3e3)",
                border: "none",
                borderRadius: 999,
                padding: 12,
                boxShadow: "inset 0 2px 0 #fff, 0 3px 0 #005c5c",
                cursor: "pointer",
              }}
            >
              Add to the mix
            </button>
            {notice && <div style={{ fontSize: 10, fontWeight: 700, color: "#00807f", minHeight: 13 }}>{notice}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Verify the full flow manually**

```bash
npx dotenv -e .env.local -- npm run dev
```

In a browser at `http://127.0.0.1:3000`:
1. Go to the Sounds tab, type "paper bag" into the search box — expect a dropdown with "Paper Bag" by Fiona Apple (and others) within about half a second of pausing.
2. Click it — the dropdown is replaced by a "Paper Bag — Fiona Apple" chip.
3. Type a name, click "Add to the mix" — expect it appears immediately in the list above with its album art, and the notice reads "Added to the mix!".
4. Reload the page (hard refresh) — expect the track is still there (proves it came from Postgres, not just local state).
5. Search "paper bag" again, select it, add it again with any name — expect the notice "Already on the mix!" and the list still shows only one copy.

- [ ] **Step 9: Commit**

```bash
git add lib/audrey-data.ts app/actions.ts app/page.tsx next.config.ts components/AudreySite.tsx components/tabs/SoundsTab.tsx
git commit -m "feat: replace manual song entry with Spotify search backed by shared Postgres playlist"
```

---

## Task 5: Spotify OAuth helpers

**Files:**
- Modify: `lib/spotify.ts`

**Interfaces:**
- Consumes: `process.env.SPOTIFY_CLIENT_ID`, `process.env.SPOTIFY_CLIENT_SECRET`, `process.env.SPOTIFY_REDIRECT_URI`.
- Produces: `SpotifyUserTokens`, `getAuthorizeUrl(state: string): string`, `exchangeCodeForTokens(code: string): Promise<SpotifyUserTokens>`, `refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>`, `getSpotifyUserId(accessToken: string): Promise<string>`, `createPlaylist(accessToken: string, userId: string, name: string): Promise<string>`, `addTracksToPlaylist(accessToken: string, playlistId: string, uris: string[]): Promise<void>` — all from `@/lib/spotify`, consumed by Tasks 6–8.

- [ ] **Step 1: Add the OAuth helpers to `lib/spotify.ts`**

Append to the existing file (below `searchTracks`):

```ts
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

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
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
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
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
```

`getAppAccessToken` (from Task 3) already calls `requireClientCredentials()` — no changes needed there; the helper it already uses is the same one `getAuthorizeUrl` and `basicAuthHeader` now share.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify the one pure function directly**

`getAuthorizeUrl` needs no network call, so it's checkable now; the rest (`exchangeCodeForTokens`, `refreshAccessToken`, `getSpotifyUserId`, `createPlaylist`, `addTracksToPlaylist`) require a real OAuth token and are exercised end-to-end in Task 7.

```ts
// scripts/_verify-authorize-url.ts
import { getAuthorizeUrl } from "../lib/spotify";
console.log(getAuthorizeUrl("test-state-123"));
```

```bash
npx dotenv -e .env.local -- npx tsx scripts/_verify-authorize-url.ts
```

Expected: a single URL starting with `https://accounts.spotify.com/authorize?` whose query string includes your real `client_id`, `response_type=code`, your `redirect_uri` (URL-encoded), `scope=playlist-modify-public+playlist-modify-private`, and `state=test-state-123`.

```bash
rm scripts/_verify-authorize-url.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts
git commit -m "feat: add Spotify OAuth token exchange and playlist helpers"
```

---

## Task 6: Connect flow — passphrase gate + redirect to Spotify

**Files:**
- Modify: `app/actions.ts`
- Create: `app/connect-spotify/page.tsx`
- Create: `app/connect-spotify/ConnectSpotifyForm.tsx`

**Interfaces:**
- Consumes: `getAuthorizeUrl` from `@/lib/spotify` (Task 5); `process.env.CONNECT_PASSPHRASE`.
- Produces: `connectSpotify(passphrase: string): Promise<{ ok: false; error: string } | void>` from `@/app/actions` (throws via `redirect()` on success — never returns a value in that case); the `spotify_oauth_state` cookie name, reused by Task 7's callback handler.

- [ ] **Step 1: Add `connectSpotify` to `app/actions.ts`**

Add these imports to the top of the file (alongside the existing ones):

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthorizeUrl } from "@/lib/spotify";
```

Append:

```ts
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
```

- [ ] **Step 2: Write the connect page**

```tsx
// app/connect-spotify/page.tsx
import ConnectSpotifyForm from "./ConnectSpotifyForm";

export default async function ConnectSpotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; count?: string }>;
}) {
  const { status, count } = await searchParams;

  if (status === "connected") {
    return (
      <main style={{ padding: 40, fontFamily: "Verdana, Geneva, sans-serif", maxWidth: 480, margin: "0 auto" }}>
        <h1>Connected ✅</h1>
        <p>
          Created the birthday playlist on your Spotify account
          {count ? ` with ${count} song${count === "1" ? "" : "s"} already on it` : ""}. New songs friends add
          will keep showing up there automatically.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, fontFamily: "Verdana, Geneva, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <h1>Connect Spotify</h1>
      <p>Enter the passphrase to connect your Spotify account and create the birthday playlist.</p>
      <ConnectSpotifyForm />
    </main>
  );
}
```

- [ ] **Step 3: Write the client form**

```tsx
// app/connect-spotify/ConnectSpotifyForm.tsx
"use client";

import { useActionState } from "react";
import { connectSpotify } from "@/app/actions";

type FormState = { ok: false; error: string } | null;

export default function ConnectSpotifyForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const passphrase = String(formData.get("passphrase") ?? "");
    const result = await connectSpotify(passphrase);
    return result ?? null;
  }, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
      <input
        type="password"
        name="passphrase"
        placeholder="passphrase"
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          border: "none",
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          background: "#1DB954",
          color: "#fff",
        }}
      >
        {pending ? "Connecting…" : "Connect Spotify"}
      </button>
      {state && !state.ok && <div style={{ color: "#a3005e", fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify the gate and redirect manually**

```bash
npx dotenv -e .env.local -- npm run dev
```

Visit `http://127.0.0.1:3000/connect-spotify` (must be `127.0.0.1`, matching the registered redirect URI):
1. Enter a wrong passphrase, submit — expect the inline error "That's not the right passphrase." with no navigation.
2. Enter the real passphrase from `.env.local`, submit — expect the browser navigates to Spotify's real consent screen, showing your app's name and requesting playlist-modify permission.

Stop there — don't approve yet, since the callback route doesn't exist until Task 7 and would 404. This step only confirms the passphrase gate and the redirect to Spotify are wired correctly.

- [ ] **Step 6: Commit**

```bash
git add app/actions.ts app/connect-spotify
git commit -m "feat: add passphrase-gated Spotify connect entry point"
```

---

## Task 7: OAuth callback — create playlist + bulk sync

**Files:**
- Create: `app/api/spotify/callback/route.ts`

**Interfaces:**
- Consumes: `exchangeCodeForTokens`, `getSpotifyUserId`, `createPlaylist`, `addTracksToPlaylist` from `@/lib/spotify` (Task 5); `getDb()` from `@/lib/db` (Task 2); `tracks`, `spotifyConnection` from `@/lib/db/schema` (Task 2); the `spotify_oauth_state` cookie set by `connectSpotify` (Task 6); `NAME` from `@/lib/audrey-data`.
- Produces: nothing new consumed elsewhere — this is the terminal step of the connect flow.

- [ ] **Step 1: Write the callback Route Handler**

```ts
// app/api/spotify/callback/route.ts
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
    const userId = await getSpotifyUserId(tokens.accessToken);

    const db = getDb();
    const existing = (await db.select().from(spotifyConnection).limit(1))[0];

    let playlistId = existing?.playlistId ?? null;
    if (!playlistId) {
      playlistId = await createPlaylist(tokens.accessToken, userId, `${NAME}'s Birthday Mix`);
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify the full connect flow with a disposable Spotify account**

**Use a disposable/test Spotify account for this, not your own or Audrey's** — this step creates a real playlist on whichever account approves the consent screen.

Make sure at least one track already exists in `tracks` (Task 4's "Paper Bag" from its own verification step works).

```bash
npx dotenv -e .env.local -- npm run dev
```

1. Visit `http://127.0.0.1:3000/connect-spotify`, enter the passphrase, and this time follow through: log into the test account on Spotify's consent screen and approve.
2. Expect the browser lands back on `/connect-spotify?status=connected&count=1` showing "Connected ✅ ... with 1 song already on it."
3. Open Spotify (web or app) as that same test account. Confirm a new **private** playlist named "`<NAME>`'s Birthday Mix" exists (check `NAME` in `lib/audrey-data.ts` for the exact value) containing "Paper Bag" by Fiona Apple.
4. Re-visit `/connect-spotify` and reconnect with the same passphrase and account. Confirm it does **not** create a second playlist — the test account should still have exactly one "...'s Birthday Mix" playlist afterward.

- [ ] **Step 4: Commit**

```bash
git add app/api/spotify/callback
git commit -m "feat: exchange Spotify OAuth code, create playlist, and bulk-sync existing tracks"
```

---

## Task 8: Live sync on new adds

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: `getSpotifyConnection()` from `@/lib/db` (Task 2); `refreshAccessToken`, `addTracksToPlaylist` from `@/lib/spotify` (Task 5).
- Produces: no interface change — `addTrackToMix`'s signature and return shapes are unchanged from Task 4; this task only adds internal behavior.

- [ ] **Step 1: Extend `addTrackToMix` with a live-sync step**

Add these two imports to `app/actions.ts` (alongside the existing ones):

```ts
import { eq } from "drizzle-orm";
import { getDb, getSpotifyConnection } from "@/lib/db";
import { refreshAccessToken, addTracksToPlaylist } from "@/lib/spotify";
```

(`getDb` is already imported from Task 4 — just add `getSpotifyConnection` to that same import line instead of duplicating it.)

Inside `addTrackToMix`, insert this block between the duplicate check and `revalidatePath("/")`:

```ts
    if (inserted.length === 0) {
      return { ok: true, duplicate: true };
    }

    const connection = await getSpotifyConnection();
    if (connection?.playlistId) {
      try {
        const { accessToken } = await refreshAccessToken(connection.refreshToken);
        await addTracksToPlaylist(accessToken, connection.playlistId, [input.spotifyUri]);
        await getDb().update(tracks).set({ syncedAt: new Date() }).where(eq(tracks.id, inserted[0].id));
      } catch (err) {
        // Non-blocking: the track is already safely saved locally even if
        // the live push to her real playlist fails (revoked token, Spotify
        // outage, etc.) — logged only, never surfaced to the visitor.
        console.error("Live sync to Spotify playlist failed:", err);
      }
    }

    revalidatePath("/");
    return { ok: true };
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify live sync manually**

With the connection already established from Task 7:

```bash
npx dotenv -e .env.local -- npm run dev
```

1. On the site, search "Belinda Says" (Alvvays), select it, add it with any name.
2. Expect it to appear on the site immediately, same as before.
3. Open Spotify as the connected test account and refresh the "...'s Birthday Mix" playlist — expect "Belinda Says" to appear there too, without revisiting `/connect-spotify`.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts
git commit -m "feat: push newly added tracks to the connected Spotify playlist immediately"
```

---

## Task 9: Final verification pass

**Files:** none (verification only; fix-and-recommit only if something surfaces).

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors (warnings about anything outside this feature's touched files are pre-existing and out of scope).

- [ ] **Step 3: Walk the spec's testing checklist end to end**

Against the real Neon database and a disposable Spotify test account:
1. Search returns real results as you type, debounced, with a working "couldn't search right now" state if you temporarily disconnect network.
2. Adding a track persists across a hard refresh.
3. Adding the same track twice shows "Already on the mix!" and doesn't duplicate the row.
4. `/connect-spotify` rejects a wrong passphrase and accepts the right one.
5. Connecting creates exactly one private playlist, pre-populated with everything already added.
6. Reconnecting doesn't create a second playlist.
7. A track added after connecting shows up in the real playlist without revisiting `/connect-spotify`.

- [ ] **Step 4: Fix anything that surfaced, then commit**

If Steps 1–3 turn up an issue, fix it and commit:

```bash
git add -A
git commit -m "fix: address issues found in final verification pass"
```

If nothing surfaced, no commit is needed — the feature is complete as of Task 8's commit.
