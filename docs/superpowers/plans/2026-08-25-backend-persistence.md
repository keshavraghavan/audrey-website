# AudreyWare 24.0 Backend Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `localStorage`-only guestbook/playlist/photo state with real shared storage (Neon Postgres for text, Vercel Blob for images), so every visitor sees the same guestbook, playlist, and photo album.

**Architecture:** Server Components read Postgres directly at request time; Next.js Server Actions handle all writes and call `revalidatePath("/")`; the browser resizes and uploads photos straight to Vercel Blob, then a Server Action records the resulting URL in Postgres.

**Tech Stack:** Next.js 16.3.0 (App Router), Drizzle ORM (`drizzle-orm/neon-http`), `@neondatabase/serverless`, `@vercel/blob` (+ `@vercel/blob/client`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-25-backend-persistence-design.md`

## Global Constraints

- No automated test framework exists in this repo, and the spec explicitly scopes one out — every task's verification is a manual `npm run dev` walkthrough, not `npm test`.
- `@neondatabase/serverless` requires **Node.js 19+** locally.
- Cache Components (`cacheComponents` in `next.config.ts`) stays **disabled** — this app wants request-time-fresh reads by default, which is already the behavior without opting in, and Cache Components would add `use cache`/`Suspense` requirements this project doesn't need.
- `cookies()` is an **async** function in this Next.js version — always `await cookies()`.
- Server Actions are invoked directly as async functions from client event handlers, wrapped in `startTransition` (not `<form action>`, to match this codebase's existing controlled-input pattern).
- No rate limiting, no user accounts — the admin passcode is the only moderation tool (per spec, "Out of scope").
- The mock seed arrays (`SEED_MESSAGES`, `SEED_PLAYLIST`, `ALBUM`) are retired, not migrated — real tables start empty.

---

## Task 1: Provision Vercel, Neon, and Blob resources (manual)

This task has no application code — it's the checklist that makes every later task's `npm run dev` actually talk to real storage. Nothing here can be done by an automated worker; it needs your Vercel account.

**Files:** none (dashboard/CLI actions + local `.env.local`, which is git-ignored)

- [ ] **Step 1: Upgrade the Vercel CLI**

The installed CLI (50.37.3) is behind current (59.5.0).

```bash
npm i -g vercel@latest
vercel --version
```

Expected: version 59.x or newer.

- [ ] **Step 2: Log in and link the repo to a Vercel project**

```bash
cd /Users/raghavankeshav/projects/audrey-website
vercel login
vercel link
```

Follow the prompts to create a new project (or link an existing one). This creates `.vercel/project.json` locally — already covered by the default Next.js `.gitignore`, but verify:

```bash
git check-ignore -v .vercel/project.json
```

Expected: prints a match against `.gitignore`'s `.vercel` entry (confirming it won't be committed).

- [ ] **Step 3: Add the Neon Postgres integration**

```bash
vercel integration add neon
```

Follow the prompts to create a new Neon project and database, connected to this Vercel project. This provisions `DATABASE_URL` (and related Neon env vars) automatically.

If the CLI flow doesn't cover it, use the dashboard instead: **Project → Storage → Create Database → Postgres (Neon)**.

- [ ] **Step 4: Create a Vercel Blob store**

Via the dashboard (no CLI equivalent needed): **Project → Storage → Create Database → Blob**. Name it something like "audrey-photos", set access to **Public** (the whole site is public, and Blob URLs are the `<img src>` for photos), and — important — make sure **Development** is checked among the connected environments, not just Production/Preview. This is what makes `BLOB_READ_WRITE_TOKEN` show up when you `vercel env pull` locally; if you skip it, add it later via the store's **Projects** tab → **Update Project Connection**.

- [ ] **Step 5: Set the admin passcode**

Pick a passcode only you'll use to reach `/admin`. Not a provisioned integration value — you're setting it directly:

```bash
vercel env add ADMIN_PASSCODE
```

When prompted for environments, select all three (Production, Preview, Development) so the same passcode works everywhere.

- [ ] **Step 6: Pull everything into `.env.local`**

```bash
vercel env pull .env.local
```

Expected: `.env.local` now contains at minimum `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `ADMIN_PASSCODE`. Confirm:

```bash
grep -E '^(DATABASE_URL|BLOB_READ_WRITE_TOKEN|ADMIN_PASSCODE)=' .env.local
```

Expected: all three lines present with non-empty values.

- [ ] **Step 7: Confirm Node version locally**

```bash
node -v
```

Expected: v19 or higher (the Neon serverless driver's floor). If lower, upgrade (e.g. `nvm install --lts && nvm use --lts`) before Task 2.

**No commit for this task** — it produces no tracked files (`.env.local` stays local and untracked).

---

## Task 2: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces: `@vercel/blob`, `@neondatabase/serverless`, `drizzle-orm` as runtime deps; `drizzle-kit`, `dotenv-cli`, `tsx` as dev deps — every later task assumes these are installed.

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install @vercel/blob @neondatabase/serverless drizzle-orm
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D drizzle-kit dotenv-cli tsx
```

`dotenv-cli` lets non-Next.js scripts (drizzle-kit, tsx) see `.env.local`, since only Next.js itself auto-loads it. `tsx` is used for the one-off verification script in Task 4.

- [ ] **Step 3: Verify the install**

```bash
npm ls @vercel/blob @neondatabase/serverless drizzle-orm drizzle-kit dotenv-cli tsx
```

Expected: all six list a resolved version with no `UNMET DEPENDENCY` or `invalid` markers.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add Drizzle, Neon, and Vercel Blob dependencies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Define the Drizzle schema and push it to Neon

**Files:**
- Create: `drizzle.config.ts`
- Create: `lib/db/schema.ts`

**Interfaces:**
- Produces: `guestbookMessages`, `guestbookPhotos`, `playlistTracks`, `albumPhotos` tables, and types `GuestbookMessageRow`, `GuestbookPhotoRow`, `PlaylistTrackRow`, `AlbumPhotoRow` — consumed by every task from here on.

- [ ] **Step 1: Write the Drizzle config**

`drizzle.config.ts`:

```ts
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

- [ ] **Step 2: Write the schema**

`lib/db/schema.ts`:

```ts
import { integer, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const guestbookMessages = pgTable("guestbook_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  relation: text("relation"),
  body: text("body").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guestbookPhotos = pgTable("guestbook_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => guestbookMessages.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const playlistTracks = pgTable("playlist_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  artist: text("artist"),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const albumPhotos = pgTable("album_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  blobUrl: text("blob_url").notNull(),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuestbookMessageRow = typeof guestbookMessages.$inferSelect;
export type GuestbookPhotoRow = typeof guestbookPhotos.$inferSelect;
export type PlaylistTrackRow = typeof playlistTracks.$inferSelect;
export type AlbumPhotoRow = typeof albumPhotos.$inferSelect;
```

- [ ] **Step 3: Push the schema to Neon**

```bash
npx dotenv -e .env.local -- npx drizzle-kit push
```

Since the database is empty, this should apply without ambiguity. If it prompts for confirmation (e.g. "Is X table created or renamed?"), it's a fresh `create table` for all four tables — confirm.

Expected output: a summary listing `guestbook_messages`, `guestbook_photos`, `playlist_tracks`, and `album_photos` created.

- [ ] **Step 4: Verify the tables exist**

```bash
npx dotenv -e .env.local -- npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
sql\`select table_name from information_schema.tables where table_schema = 'public' order by table_name\`.then((rows) => console.log(rows.map((r) => r.table_name)));
"
```

Expected: `[ 'album_photos', 'guestbook_messages', 'guestbook_photos', 'playlist_tracks' ]`.

- [ ] **Step 5: Commit**

```bash
git add drizzle.config.ts lib/db/schema.ts
git commit -m "Add Drizzle schema for guestbook, playlist, and album tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: DB client, query helpers, and wire real reads into the page

**Files:**
- Create: `lib/db/index.ts`
- Create: `lib/db/queries.ts`
- Create: `lib/message-style.ts`
- Modify: `app/page.tsx`
- Modify: `components/AudreySite.tsx`
- Modify: `components/tabs/HomeTab.tsx`
- Modify: `components/tabs/GuestbookTab.tsx`
- Modify: `components/tabs/SoundsTab.tsx`
- Modify: `components/tabs/PhotosTab.tsx`
- Modify: `lib/audrey-data.ts`

**Interfaces:**
- Consumes: `guestbookMessages`, `guestbookPhotos`, `playlistTracks`, `albumPhotos`, `GuestbookMessageRow`, `PlaylistTrackRow`, `AlbumPhotoRow` from Task 3's `lib/db/schema.ts`.
- Produces: `getDb()` (lazy DB client), `getMessages(): Promise<MessageWithPhotos[]>`, `getPlaylist(): Promise<PlaylistTrackRow[]>`, `getAlbumPhotos(): Promise<AlbumPhotoRow[]>`, `MessageWithPhotos` type, `tintForIndex`, `swatchForIndex`, `formatMeta` — consumed by every later task that renders real data or writes new rows.

- [ ] **Step 1: Write the lazy DB client**

`lib/db/index.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy so `next build` doesn't crash if DATABASE_URL isn't set yet at build
// time (e.g. before Task 1's provisioning). Do not wrap this in a Proxy —
// some libraries inspect the db object's own properties/methods directly,
// and a Proxy breaks those checks.
function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
```

- [ ] **Step 2: Write the query helpers**

`lib/db/queries.ts`:

```ts
import { desc } from "drizzle-orm";
import { getDb } from "./index";
import { albumPhotos, guestbookMessages, guestbookPhotos, playlistTracks } from "./schema";

export type MessageWithPhotos = {
  id: string;
  name: string;
  relation: string | null;
  body: string;
  likes: number;
  createdAt: Date;
  photoUrls: string[];
};

export async function getMessages(): Promise<MessageWithPhotos[]> {
  const db = getDb();
  const [messages, photos] = await Promise.all([
    db.select().from(guestbookMessages).orderBy(desc(guestbookMessages.createdAt)),
    db.select().from(guestbookPhotos),
  ]);

  const photosByMessage = new Map<string, string[]>();
  for (const photo of [...photos].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = photosByMessage.get(photo.messageId) ?? [];
    list.push(photo.blobUrl);
    photosByMessage.set(photo.messageId, list);
  }

  return messages.map((m) => ({ ...m, photoUrls: photosByMessage.get(m.id) ?? [] }));
}

export async function getPlaylist() {
  const db = getDb();
  return db.select().from(playlistTracks).orderBy(playlistTracks.createdAt);
}

export async function getAlbumPhotos() {
  const db = getDb();
  return db.select().from(albumPhotos).orderBy(desc(albumPhotos.createdAt));
}
```

- [ ] **Step 3: Verify the queries against the (still-empty) tables**

```bash
npx dotenv -e .env.local -- npx tsx -e "
import { getMessages, getPlaylist, getAlbumPhotos } from './lib/db/queries.ts';
Promise.all([getMessages(), getPlaylist(), getAlbumPhotos()]).then((r) => console.log(JSON.stringify(r)));
"
```

Expected: `[[],[],[]]`.

- [ ] **Step 4: Write the presentation helpers for message styling and relative time**

These replace the per-seed-message hardcoded `swatch`/`tint`/`meta` strings — tint/swatch now cycle by the message's position, and the relative-time string is computed at render time from `createdAt`.

`lib/message-style.ts`:

```ts
export type MessageTint = "pink" | "teal" | "gold";

const TINTS: MessageTint[] = ["pink", "teal", "gold"];

const SWATCHES: Record<MessageTint, string> = {
  pink: "linear-gradient(135deg, #ff8ec9, #d6006e)",
  teal: "linear-gradient(135deg, #7de3e3, #009a9a)",
  gold: "linear-gradient(135deg, #ffe680, #ffb300)",
};

export function tintForIndex(index: number): MessageTint {
  return TINTS[index % TINTS.length];
}

export function swatchForIndex(index: number): string {
  return SWATCHES[tintForIndex(index)];
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function formatMeta(relation: string | null, createdAt: Date): string {
  const time = formatRelativeTime(createdAt);
  return relation ? `${relation} · ${time}` : time;
}
```

- [ ] **Step 5: Trim `lib/audrey-data.ts` to just the static content**

Remove `GuestbookMessage`, `MessageTint`, `SEED_MESSAGES`, `Track`, `SEED_PLAYLIST`, `AlbumPhoto`, `ALBUM` — all of it is now either DB-backed (`lib/db/schema.ts`) or replaced by `lib/message-style.ts`. Keep everything else (`TABS`, `Tab`, `Book`, `SHELF`, `Artist`, `ARTISTS`, `SONG_PALETTES`, `BAR_HEIGHTS`, `BAR_COLORS`, site constants).

Read the current file and remove exactly those blocks — the result should still export `Tab`, `TABS`, `Book`, `SHELF`, `Artist`, `ARTISTS`, `SONG_PALETTES`, `BAR_HEIGHTS`, `BAR_COLORS`, `NAME`, `AGE`, `ACCENT`, `BIRTHDAY`, `BOOKS_READ`, `FIVE_STAR_COUNT`, `BOOKS_TO_GOAL`, `READING_GOAL`. Update the file's top comment (currently describes the localStorage behavior being removed) to:

```ts
// Static content for the AudreyWare 24.0 birthday site — books and top
// artists are curated flavor content, not visitor input, so they stay
// hardcoded here. Guestbook messages, the playlist, and album photos are
// real data now; see lib/db/schema.ts and lib/db/queries.ts.
```

- [ ] **Step 6: Make `app/page.tsx` an async Server Component that fetches real data**

`app/page.tsx`:

```tsx
import AudreySite from "@/components/AudreySite";
import { getAlbumPhotos, getMessages, getPlaylist } from "@/lib/db/queries";

export default async function Home() {
  const results = await Promise.allSettled([getMessages(), getPlaylist(), getAlbumPhotos()]);
  const [messagesResult, playlistResult, albumResult] = results;

  const loadError = results.some((r) => r.status === "rejected");
  if (loadError) {
    for (const r of results) {
      if (r.status === "rejected") console.error("Failed to load site data:", r.reason);
    }
  }

  return (
    <AudreySite
      initialMessages={messagesResult.status === "fulfilled" ? messagesResult.value : []}
      initialPlaylist={playlistResult.status === "fulfilled" ? playlistResult.value : []}
      initialAlbumPhotos={albumResult.status === "fulfilled" ? albumResult.value : []}
      loadError={loadError}
    />
  );
}
```

- [ ] **Step 7: Rewrite `components/AudreySite.tsx` to consume real initial data**

Replace the whole file. This drops `SEED_MESSAGES`/`SEED_PLAYLIST` imports and the broad `localStorage` sync effect, keeping only a `liked`-flags effect (which stays client-only by design — see spec). The `postMessage`/`addSong`/`toggleLike` handlers still do local-only mutation for now; Tasks 5–7 wire them to the real Server Actions.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import HomeTab from "@/components/tabs/HomeTab";
import ShelfTab from "@/components/tabs/ShelfTab";
import SoundsTab from "@/components/tabs/SoundsTab";
import PhotosTab from "@/components/tabs/PhotosTab";
import GuestbookTab from "@/components/tabs/GuestbookTab";
import { ACCENT, AGE, BIRTHDAY, NAME, TABS, type Tab } from "@/lib/audrey-data";
import type { AlbumPhotoRow, PlaylistTrackRow } from "@/lib/db/schema";
import type { MessageWithPhotos } from "@/lib/db/queries";

const LIKED_STORAGE_KEY = "audreyware24:liked";
const MARQUEE_TEXT =
  "✿ sign the guestbook ✿ add a song to her playlist ✿ 41 books this year ✿ drop a photo in the album ✿ tell us your first memory of her ✿ ";

export default function AudreySite({
  initialMessages,
  initialPlaylist,
  initialAlbumPhotos,
  loadError,
}: {
  initialMessages: MessageWithPhotos[];
  initialPlaylist: PlaylistTrackRow[];
  initialAlbumPhotos: AlbumPhotoRow[];
  loadError: boolean;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [messages, setMessages] = useState<MessageWithPhotos[]>(initialMessages);
  const [playlist, setPlaylist] = useState<PlaylistTrackRow[]>(initialPlaylist);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhotoRow[]>(initialAlbumPhotos);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  const [formName, setFormName] = useState("");
  const [formRelation, setFormRelation] = useState("");
  const [formBody, setFormBody] = useState("");
  const [notice, setNotice] = useState("");

  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songBy, setSongBy] = useState("");

  const [daysToGo, setDaysToGo] = useState<number | null>(null);

  // "Have I already liked this" is intentionally client-only — it's a UX
  // nicety to stop one browser from double-clicking, not enforced data.
  // The shared like count itself lives in Postgres (see Task 6).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    document.documentElement.style.setProperty("--accent", ACCENT);
    setDaysToGo(Math.max(0, Math.ceil((BIRTHDAY.getTime() - Date.now()) / 86400000)));
    try {
      const saved = window.localStorage.getItem(LIKED_STORAGE_KEY);
      if (saved) setLiked(JSON.parse(saved));
    } catch {
      // Corrupt or unavailable storage — buttons just start unliked.
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(liked));
    } catch {
      // Storage full or disabled — likes still work, just won't persist locally.
    }
  }, [liked, hydrated]);

  const goTo = useCallback((t: Tab) => setTab(t), []);

  const toggleLike = useCallback((id: string) => {
    setLiked((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const postMessage = useCallback(() => {
    if (!formName.trim() || !formBody.trim()) {
      setNotice("Need a name and a note before we can post it.");
      return;
    }
    setNotice("Posting…");
  }, [formName, formBody]);

  const addSong = useCallback(() => {
    if (!songTitle.trim()) return;
  }, [songTitle]);

  const nameUpper = NAME.toUpperCase();
  const daysLabel =
    daysToGo === null ? "counting the days…" : daysToGo > 0 ? `${daysToGo} days until she opens this` : "it's today — go tell her";

  return (
    <div style={{ minHeight: "100vh", fontFamily: "Verdana, Geneva, sans-serif", color: "#4a3341" }}>
      <div
        style={{
          background: "linear-gradient(var(--accent-soft), var(--accent-dark))",
          color: "#fff",
          padding: "7px clamp(12px, 3vw, 20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 14px",
          flexWrap: "wrap",
          fontFamily: "var(--font-vt323)",
          fontSize: "clamp(16px, 4vw, 19px)",
          letterSpacing: "0.08em",
        }}
      >
        <span>◆ AUDREYWARE 24.0 — birthday edition</span>
        <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span>SEP·20·2026</span>
          <span
            style={{
              background: "#2b0a1e",
              color: "#00ff9d",
              fontFamily: "var(--font-press-start-2p)",
              fontSize: 11,
              padding: "4px 7px",
              letterSpacing: "0.1em",
            }}
          >
            0 0 4 1 2
          </span>
        </span>
      </div>

      <div style={{ overflow: "hidden", background: "#faf2f5", borderBottom: "2px solid var(--accent)", padding: "5px 0" }}>
        <div
          style={{
            display: "flex",
            width: "200%",
            animation: "cd-marquee 26s linear infinite",
            fontFamily: "var(--font-vt323)",
            fontSize: 19,
            color: "var(--accent-dark)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: "50%" }}>{MARQUEE_TEXT}</span>
          <span style={{ width: "50%" }}>{MARQUEE_TEXT}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px clamp(12px, 4vw, 54px) 56px" }}>
        <div
          style={{
            background: "#faf2f5",
            overflow: "hidden",
            borderRadius: 20,
            border: "2px solid #fff",
            boxShadow: "0 16px 40px rgba(122,0,72,0.20)",
          }}
        >
          {loadError && (
            <div style={{ background: "#fff3f0", color: "#a3005e", fontSize: 12, padding: "10px 20px", textAlign: "center" }}>
              Having trouble loading the latest — showing what we've got. Try refreshing.
            </div>
          )}
          <div
            style={{
              background:
                "linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 48%, var(--accent-dark) 52%, var(--accent) 100%)",
              padding: "clamp(28px, 4vw, 44px) clamp(20px, 4vw, 48px) clamp(30px, 4vw, 46px)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(rgba(255,255,255,0.42), rgba(255,255,255,0))",
              }}
            />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
              <div style={{ maxWidth: "min(520px, 100%)" }}>
                <div style={{ fontFamily: "var(--font-press-start-2p)", fontSize: 11, color: "#ffd9ec", letterSpacing: "0.05em" }}>
                  {nameUpper} · VERSION {AGE}.0
                </div>
                <h1
                  style={{
                    margin: "16px 0 0",
                    fontFamily: "var(--font-archivo-black)",
                    fontSize: "clamp(38px, 7vw, 72px)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.04em",
                    color: "#fff",
                    textShadow: "0 3px 0 #a3005e, 0 7px 16px rgba(0,0,0,0.28)",
                  }}
                >
                  HAPPY
                  <br />
                  BIRTHDAY
                  <br />
                  {nameUpper}!
                </h1>
                <div style={{ marginTop: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => goTo("guestbook")}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#a3005e",
                      background: "linear-gradient(#fdf5f8, #f7cfe3)",
                      padding: "14px 28px",
                      border: "none",
                      borderRadius: 999,
                      boxShadow: "inset 0 2px 0 #fff, 0 4px 0 #a3005e",
                      cursor: "pointer",
                    }}
                  >
                    Sign the guestbook
                  </button>
                  <button
                    onClick={() => goTo("sounds")}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#005c5c",
                      background: "linear-gradient(#e3f4f4, #7de3e3)",
                      padding: "14px 28px",
                      border: "none",
                      borderRadius: 999,
                      boxShadow: "inset 0 2px 0 #fff, 0 4px 0 #005c5c",
                      cursor: "pointer",
                    }}
                  >
                    Add a song
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontFamily: "var(--font-vt323)",
                    fontSize: 21,
                    color: "#ffe680",
                    animation: "cd-blink 1.3s steps(1) infinite",
                  }}
                >
                  ◄ NEW ► {daysLabel}
                </div>
              </div>
              <div
                style={{
                  flex: "none",
                  width: "clamp(116px, 17vw, 172px)",
                  height: "clamp(116px, 17vw, 172px)",
                  borderRadius: "50%",
                  background: "conic-gradient(from 200deg, #7de3e3, #ff5fb0, #ffe680, #7de3e3, #ff5fb0)",
                  boxShadow: "0 10px 26px rgba(0,0,0,0.32)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "cd-spin 9s linear infinite",
                }}
              >
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", boxShadow: "inset 0 0 0 7px #fff" }} />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
              padding: "14px clamp(14px, 3vw, 40px)",
              background: "#faf2f5",
              borderBottom: "1px solid #f0c9dc",
              flexWrap: "wrap",
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => goTo(t.key)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "11px 18px",
                    borderRadius: 999,
                    flex: "none",
                    whiteSpace: "nowrap",
                    background: active ? "var(--accent)" : "#ecdde5",
                    color: active ? "#fff" : "#7f5f70",
                    boxShadow: active
                      ? "inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(122,0,72,0.45)"
                      : "inset 0 1px 0 #fff",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "home" && (
            <HomeTab
              recentMessages={messages.slice(0, 2)}
              messageCount={messages.length}
              albumPhotos={albumPhotos}
              onGoGuestbook={() => goTo("guestbook")}
              onGoPhotos={() => goTo("photos")}
            />
          )}
          {tab === "shelf" && <ShelfTab />}
          {tab === "sounds" && (
            <SoundsTab
              playlist={playlist}
              songTitle={songTitle}
              songArtist={songArtist}
              songBy={songBy}
              onSongTitleChange={setSongTitle}
              onSongArtistChange={setSongArtist}
              onSongByChange={setSongBy}
              onAddSong={addSong}
            />
          )}
          {tab === "photos" && (
            <PhotosTab photos={albumPhotos} onPhotoAdded={(p) => setAlbumPhotos((prev) => [p, ...prev])} />
          )}
          {tab === "guestbook" && (
            <GuestbookTab
              messages={messages}
              liked={liked}
              onToggleLike={toggleLike}
              formName={formName}
              formRelation={formRelation}
              formBody={formBody}
              onFormNameChange={setFormName}
              onFormRelationChange={setFormRelation}
              onFormBodyChange={setFormBody}
              notice={notice}
              onPostMessage={postMessage}
            />
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "16px 40px",
            textAlign: "center",
            fontFamily: "var(--font-vt323)",
            fontSize: 18,
            color: "#8a5875",
            letterSpacing: "0.06em",
          }}
        >
          made by her friends · best viewed with the sound on · © 2026 audreyware
        </div>
      </div>
    </div>
  );
}
```

Note: `postMessage`/`addSong` are intentionally left as stubs that only handle the empty-input case — Tasks 5 and 7 fill them in. `setPlaylist` is temporarily unused (will be used in Task 7); ESLint may flag it as unused in the interim — that's expected and resolved by the next task, not a bug to fix now.

- [ ] **Step 8: Update `HomeTab`, `GuestbookTab`, `SoundsTab`, `PhotosTab` to accept real data shapes**

In `components/tabs/HomeTab.tsx`: change the props type to take `recentMessages: MessageWithPhotos[]` (import from `@/lib/db/queries`) and `albumPhotos: AlbumPhotoRow[]` (import from `@/lib/db/schema`) instead of `GuestbookMessage[]`/derived `ALBUM`. Replace the `photoTiles` derivation and rendering:

```tsx
import type { AlbumPhotoRow } from "@/lib/db/schema";
import type { MessageWithPhotos } from "@/lib/db/queries";
import { formatMeta, swatchForIndex } from "@/lib/message-style";
import {
  BAR_COLORS,
  BAR_HEIGHTS,
  BOOKS_READ,
  BOOKS_TO_GOAL,
  FIVE_STAR_COUNT,
} from "@/lib/audrey-data";
```

Remove the `PhotoSlot` import and the `ALBUM` import. Replace the `HomeTab` props type's `recentMessages: GuestbookMessage[]` with `recentMessages: MessageWithPhotos[]` and add `albumPhotos: AlbumPhotoRow[]`. Replace:

```tsx
const photoTiles = ALBUM.slice(0, 4);
```

with:

```tsx
const photoTiles = albumPhotos.slice(0, 4);
```

Replace the message-rendering block's avatar swatch and meta text — `m.swatch` and `m.meta` no longer exist on the row type:

```tsx
{recentMessages.map((m, i) => (
  <div
    key={m.id}
    style={{
      borderRadius: 12,
      background: "linear-gradient(#fdf7f9, #f6e8ef)",
      boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.08)",
      padding: "16px 18px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: swatchForIndex(i), flex: "none" }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>
        {m.name} <span style={{ fontWeight: 400, color: "#8a5875" }}>{formatMeta(m.relation, m.createdAt)}</span>
      </div>
    </div>
    <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 1.75, color: "#4a3341", textWrap: "pretty" }}>
      {m.body}
    </p>
  </div>
))}
```

Replace the album-preview tile grid (was `PhotoSlot` per fixed id):

```tsx
<div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
  {photoTiles.length > 0 ? (
    photoTiles.map((p) => (
      <div key={p.id} style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden" }}>
        {/* Already-resized upload — next/image has nothing to optimize here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.blobUrl} alt={p.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    ))
  ) : (
    <div
      style={{
        gridColumn: "1 / -1",
        borderRadius: 8,
        border: "2px dashed #eeb0cf",
        padding: "18px 8px",
        textAlign: "center",
        fontSize: 11,
        color: "#8a5875",
      }}
    >
      No photos yet — be the first.
    </div>
  )}
</div>
```

In `components/tabs/GuestbookTab.tsx`: change the `messages` prop type to `MessageWithPhotos[]` (import from `@/lib/db/queries`), remove the `MessageTint`/`tintStyle` import from `@/lib/audrey-data` and instead import `tintForIndex, swatchForIndex, formatMeta` and the `MessageTint` type from `@/lib/message-style`. Update the mapping to compute per-index styling and drop the old `photos`-boolean-driven hardcoded `PhotoSlot`s in favor of `m.photoUrls`:

```tsx
{messages.map((m, i) => {
  const isLiked = !!liked[m.id];
  return (
    <div key={m.id} style={{ borderRadius: 12, padding: "18px 20px", ...tintStyle(tintForIndex(i)) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: swatchForIndex(i), flex: "none" }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>
          {m.name} <span style={{ fontWeight: 400, color: "#8a5875" }}>{formatMeta(m.relation, m.createdAt)}</span>
        </div>
      </div>
      <p style={{ margin: "11px 0 0", fontSize: 14, lineHeight: 1.8, color: "#4a3341", textWrap: "pretty" }}>
        {m.body}
      </p>
      {m.photoUrls.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 9 }}>
          {m.photoUrls.map((url) => (
            <div key={url} style={{ width: 104, height: 78, borderRadius: 8, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => onToggleLike(m.id)}
          style={{
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "10px 18px",
            background: isLiked ? "linear-gradient(#ff5fb0, #d6006e)" : "#fdf7f9",
            color: isLiked ? "#fff" : "#d6006e",
            boxShadow: isLiked ? "0 2px 0 #a3005e" : "inset 0 0 0 1px #f0c9dc",
          }}
        >
          ♡ {m.likes}
        </button>
      </div>
    </div>
  );
})}
```

`tintStyle(tint: MessageTint)` at the top of the file keeps its current implementation, just import `MessageTint` from `@/lib/message-style` instead of `@/lib/audrey-data`. Remove the `PhotoSlot` import (no longer used in this step — Task 10 reintroduces photo handling in the form itself via `PhotoUploader`, added in Task 8). Leave the "+ ADD PHOTOS (3 MAX)" block as-is for now; Task 10 wires it up.

Note the like count is now `m.likes` directly (already includes this visitor's like, since `onToggleLike` will call the server and get the true count back in Task 6) rather than `m.likes + (isLiked ? 1 : 0)`.

In `components/tabs/SoundsTab.tsx`: change the `playlist` prop type to `PlaylistTrackRow[]` (import from `@/lib/db/schema`), drop the `Track` import from `@/lib/audrey-data`, and derive each row's gradient by index instead of a stored `colors` tuple:

```tsx
import { ARTISTS, SONG_PALETTES } from "@/lib/audrey-data";
import type { PlaylistTrackRow } from "@/lib/db/schema";
```

```tsx
{playlist.map((t, i) => {
  const [c1, c2] = SONG_PALETTES[i % SONG_PALETTES.length];
  return (
    <div key={t.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #eef0f0" }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, flex: "none", background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>{t.title}</div>
        <div style={{ fontSize: 11, color: "#8a5875" }}>{t.artist || "—"}</div>
      </div>
      <div style={{ fontSize: 11, color: "#9c6d89", textAlign: "right" }}>
        added by
        <br />
        <span style={{ color: "var(--accent-dark)", fontWeight: 700 }}>{t.addedBy || "anonymous"}</span>
      </div>
    </div>
  );
})}
```

In `components/tabs/PhotosTab.tsx`: change props to `{ photos: AlbumPhotoRow[]; onPhotoAdded: (photo: AlbumPhotoRow) => void }`, drop the `PhotoSlot`/`ALBUM` imports, and render from `photos` — this is finished properly in Task 9 (which adds the upload tile); for this step, just make it compile and display existing photos:

```tsx
import type { AlbumPhotoRow } from "@/lib/db/schema";

export default function PhotosTab({ photos }: { photos: AlbumPhotoRow[]; onPhotoAdded: (photo: AlbumPhotoRow) => void }) {
  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
        THE ALBUM
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>
        Everyone drops their photos of her here. {photos.length} so far.
      </p>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 14 }}>
        {photos.map((p) => (
          <div
            key={p.id}
            style={{
              borderRadius: 12,
              background: "#fdf7f9",
              boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.1)",
              padding: "9px 9px 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 7, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.blobUrl} alt={p.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            {p.caption && <div style={{ padding: "9px 2px 11px", fontSize: 11, color: "#8a5875" }}>{p.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify**

```bash
npm run dev
```

Visit `http://localhost:3000`. Expected: page loads with no server-side errors in the terminal; Home tab shows "0" messages and "No photos yet"; Guestbook tab shows "0 messages"; Sounds tab shows "0 songs" in "THE BIRTHDAY MIX"; Photos tab shows an empty grid. `ShelfTab` (untouched) still renders the static book list.

- [ ] **Step 10: Commit**

```bash
git add lib/db/index.ts lib/db/queries.ts lib/message-style.ts lib/audrey-data.ts \
  app/page.tsx components/AudreySite.tsx \
  components/tabs/HomeTab.tsx components/tabs/GuestbookTab.tsx \
  components/tabs/SoundsTab.tsx components/tabs/PhotosTab.tsx
git commit -m "Wire real Postgres reads into the site; retire mock seed data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `postMessage` Server Action (text-only)

**Files:**
- Create: `app/actions.ts`
- Modify: `components/AudreySite.tsx`

**Interfaces:**
- Consumes: `getDb()` from `lib/db/index.ts`, `guestbookMessages` from `lib/db/schema.ts`.
- Produces: `postMessage(input: { name: string; relation: string; body: string }): Promise<ActionResult<{ id: string; createdAt: Date }>>` and the exported `ActionResult<T>` type — consumed by Tasks 6, 7, 9, 10, 11, 12 (which append their own actions to this same file).

- [ ] **Step 1: Create the actions file with `postMessage`**

`app/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { guestbookMessages } from "@/lib/db/schema";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function postMessage(input: {
  name: string;
  relation: string;
  body: string;
}): Promise<ActionResult<{ id: string; createdAt: Date }>> {
  const name = input.name.trim().slice(0, 60);
  const relation = input.relation.trim().slice(0, 60);
  const body = input.body.trim().slice(0, 2000);

  if (!name || !body) {
    return { ok: false, error: "Need a name and a note before we can post it." };
  }

  const db = getDb();
  try {
    const [inserted] = await db
      .insert(guestbookMessages)
      .values({ name, relation: relation || null, body })
      .returning({ id: guestbookMessages.id, createdAt: guestbookMessages.createdAt });
    revalidatePath("/");
    return { ok: true, data: inserted };
  } catch {
    return { ok: false, error: "Could not post that message — try again in a moment." };
  }
}
```

- [ ] **Step 2: Wire `AudreySite.tsx`'s `postMessage` handler to the action**

Add the import and `useTransition`:

```tsx
import { useCallback, useEffect, useState, useTransition } from "react";
import { postMessage as postMessageAction } from "@/app/actions";
```

Replace the `postMessage` callback:

```tsx
const [, startTransition] = useTransition();

const postMessage = useCallback(() => {
  if (!formName.trim() || !formBody.trim()) {
    setNotice("Need a name and a note before we can post it.");
    return;
  }
  const name = formName.trim();
  const relation = formRelation.trim();
  const body = formBody.trim();
  setNotice("Posting…");
  startTransition(async () => {
    const result = await postMessageAction({ name, relation, body });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setMessages((m) => [
      { id: result.data.id, name, relation: relation || null, body, likes: 0, createdAt: result.data.createdAt, photoUrls: [] },
      ...m,
    ]);
    setFormName("");
    setFormRelation("");
    setFormBody("");
    setNotice("Posted — she'll see it on the 20th.");
  });
}, [formName, formRelation, formBody]);
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

In the browser: go to the Guestbook tab, fill in a name and message, click "Post it". Expected: the message appears at the top of the list immediately, with "just now" as the time. Reload the page (a fresh server render) — expected: the message is still there, proving it round-tripped through Postgres, not just local state.

Also verify validation: click "Post it" with empty fields. Expected: notice reads "Need a name and a note before we can post it." and nothing is inserted.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts components/AudreySite.tsx
git commit -m "Add postMessage Server Action; guestbook text posts are now shared

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `setMessageLike` Server Action

**Files:**
- Modify: `app/actions.ts`
- Modify: `components/AudreySite.tsx`

**Interfaces:**
- Produces: `setMessageLike(id: string, liked: boolean): Promise<ActionResult<{ likes: number }>>`.

- [ ] **Step 1: Add `setMessageLike` to `app/actions.ts`**

Add these imports to the top of the file:

```ts
import { eq, sql } from "drizzle-orm";
import { guestbookMessages } from "@/lib/db/schema";
```

(`guestbookMessages` is already imported — just add `eq, sql` to the existing `drizzle-orm` import line.)

Append:

```ts
export async function setMessageLike(id: string, liked: boolean): Promise<ActionResult<{ likes: number }>> {
  const db = getDb();
  try {
    const delta = liked
      ? sql`${guestbookMessages.likes} + 1`
      : sql`greatest(${guestbookMessages.likes} - 1, 0)`;
    const [updated] = await db
      .update(guestbookMessages)
      .set({ likes: delta })
      .where(eq(guestbookMessages.id, id))
      .returning({ likes: guestbookMessages.likes });
    if (!updated) return { ok: false, error: "Message not found." };
    revalidatePath("/");
    return { ok: true, data: { likes: updated.likes } };
  } catch {
    return { ok: false, error: "Could not update that like." };
  }
}
```

- [ ] **Step 2: Wire `toggleLike` in `AudreySite.tsx`**

```tsx
import { postMessage as postMessageAction, setMessageLike } from "@/app/actions";
```

```tsx
const toggleLike = useCallback((id: string) => {
  let nextLiked = false;
  setLiked((prev) => {
    nextLiked = !prev[id];
    return { ...prev, [id]: nextLiked };
  });
  startTransition(async () => {
    const result = await setMessageLike(id, nextLiked);
    if (result.ok) {
      setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, likes: result.data.likes } : m)));
    }
  });
}, []);
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Go to Guestbook, click the ♡ on a message. Expected: count increments by 1 immediately and the button switches to the "liked" style. Click again: expected count decrements back. Reload the page: expected the count reflects the last state (proving it's a real DB column, not local-only).

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts components/AudreySite.tsx
git commit -m "Add setMessageLike Server Action; likes are now a shared counter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `addSong` Server Action

**Files:**
- Modify: `app/actions.ts`
- Modify: `components/AudreySite.tsx`

**Interfaces:**
- Produces: `addSong(input: { title: string; artist: string; addedBy: string }): Promise<ActionResult<{ id: string; createdAt: Date }>>`.

- [ ] **Step 1: Add `addSong` to `app/actions.ts`**

Add `playlistTracks` to the schema import:

```ts
import { guestbookMessages, playlistTracks } from "@/lib/db/schema";
```

Append:

```ts
export async function addSong(input: {
  title: string;
  artist: string;
  addedBy: string;
}): Promise<ActionResult<{ id: string; createdAt: Date }>> {
  const title = input.title.trim().slice(0, 120);
  const artist = input.artist.trim().slice(0, 120);
  const addedBy = input.addedBy.trim().slice(0, 60);

  if (!title) return { ok: false, error: "Add a song title first." };

  const db = getDb();
  try {
    const [inserted] = await db
      .insert(playlistTracks)
      .values({ title, artist: artist || null, addedBy: addedBy || "anonymous" })
      .returning({ id: playlistTracks.id, createdAt: playlistTracks.createdAt });
    revalidatePath("/");
    return { ok: true, data: inserted };
  } catch {
    return { ok: false, error: "Could not add that song — try again." };
  }
}
```

- [ ] **Step 2: Wire `addSong` in `AudreySite.tsx`**

```tsx
import { addSong as addSongAction, postMessage as postMessageAction, setMessageLike } from "@/app/actions";
```

```tsx
const addSong = useCallback(() => {
  if (!songTitle.trim()) return;
  const title = songTitle.trim();
  const artist = songArtist.trim();
  const addedBy = songBy.trim();
  startTransition(async () => {
    const result = await addSongAction({ title, artist, addedBy });
    if (!result.ok) return;
    setPlaylist((p) => [
      ...p,
      { id: result.data.id, title, artist: artist || null, addedBy: addedBy || "anonymous", createdAt: result.data.createdAt },
    ]);
    setSongTitle("");
    setSongArtist("");
    setSongBy("");
  });
}, [songTitle, songArtist, songBy]);
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Go to Sounds tab, fill in song/artist/name, click "Add to the mix". Expected: it appears at the bottom of "THE BIRTHDAY MIX" list immediately with a gradient swatch. Reload the page: expected the song is still there.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts components/AudreySite.tsx
git commit -m "Add addSong Server Action; playlist additions are now shared

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Blob upload token route and `PhotoUploader` component

**Files:**
- Create: `app/api/blob/upload/route.ts`
- Create: `components/PhotoUploader.tsx`

**Interfaces:**
- Produces: `POST /api/blob/upload` (consumed by `@vercel/blob/client`'s `upload()`); `<PhotoUploader onUploaded={(url: string) => void} placeholder? background? radius? dashed? />` — consumed by Tasks 9 and 10.

- [ ] **Step 1: Write the token route**

`app/api/blob/upload/route.ts`:

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

// This site has no login — uploads are intentionally open to anyone with the
// link, matching the brainstormed moderation approach (admin delete only,
// no rate limiting; see the design spec's "Moderation" decision). We do
// still cap file size and content type as basic input validation.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        addRandomSuffix: true,
        maximumSizeInBytes: 8 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        // Not used for persistence: this webhook can't reach localhost
        // without a tunnel (e.g. ngrok), so the DB row is written by an
        // explicit Server Action call right after `upload()` resolves on
        // the client (see PhotoUploader.tsx) instead of from here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Write `PhotoUploader`**

`components/PhotoUploader.tsx`:

```tsx
"use client";

import { useRef, useState, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";

// Longest side to keep an uploaded photo at — plenty sharp for these tile
// sizes without uploading a huge original camera photo.
const MAX_DIM = 1400;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/avif"];

function downscaleToBlob(file: File, maxDim: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(objectUrl);
      if (!ctx) {
        reject(new Error("could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("could not encode image"))),
        "image/webp",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("could not read that image"));
    };
    img.src = objectUrl;
  });
}

/**
 * Resizes a picked/dropped image client-side and uploads it straight to
 * Vercel Blob, reporting the resulting URL via `onUploaded`. Doesn't touch
 * the database itself — the caller decides what a new photo URL means (add
 * it to the album immediately, or hold it for a guestbook message being
 * composed).
 */
export default function PhotoUploader({
  onUploaded,
  placeholder = "drop a photo",
  background = "#f7edf2",
  radius = 8,
  dashed = false,
}: {
  onUploaded: (url: string) => void;
  placeholder?: string;
  background?: string;
  radius?: number;
  dashed?: boolean;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = async (file: File | null | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setError("Drop a PNG, JPEG, WebP, or AVIF image.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const resized = await downscaleToBlob(file, MAX_DIM);
      const uploaded = await upload(`${Date.now()}-${file.name}`, resized, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      onUploaded(uploaded.url);
    } catch {
      setError("Could not upload that photo — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={placeholder}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(false);
        void ingest(e.dataTransfer.files?.[0]);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: dashed ? 150 : undefined,
        borderRadius: radius,
        overflow: "hidden",
        cursor: busy ? "wait" : "pointer",
        background,
        border: dashed ? "2px dashed #eeb0cf" : "none",
        boxShadow: over ? "inset 0 0 0 2px var(--accent-dark)" : "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        hidden
        disabled={busy}
        onChange={(e) => {
          void ingest(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          textAlign: "center",
          padding: 8,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.4,
          color: "rgba(122,0,72,0.55)",
        }}
      >
        <span style={{ fontSize: 22, opacity: 0.6, lineHeight: 1 }}>+</span>
        <span>{busy ? "uploading…" : placeholder}</span>
      </div>
      {error && (
        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 6,
            fontSize: 10,
            color: "#b3261e",
            background: "rgba(255,255,255,0.9)",
            borderRadius: 5,
            padding: "3px 5px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no new type errors from these two files (`PhotosTab`/`GuestbookTab` don't use `PhotoUploader` yet — that's Tasks 9 and 10 — so this step only confirms the new files themselves are well-typed).

- [ ] **Step 3: Commit**

```bash
git add app/api/blob/upload/route.ts components/PhotoUploader.tsx
git commit -m "Add Blob client-upload token route and PhotoUploader component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Album gallery — `addAlbumPhoto` and wiring

**Files:**
- Modify: `app/actions.ts`
- Modify: `components/tabs/PhotosTab.tsx`

**Interfaces:**
- Consumes: `PhotoUploader` from Task 8.
- Produces: `addAlbumPhoto(input: { blobUrl: string; caption: string; uploadedBy: string }): Promise<ActionResult<{ id: string; createdAt: Date }>>`.

- [ ] **Step 1: Add `addAlbumPhoto` to `app/actions.ts`**

Add `albumPhotos` to the schema import:

```ts
import { albumPhotos, guestbookMessages, playlistTracks } from "@/lib/db/schema";
```

Append:

```ts
export async function addAlbumPhoto(input: {
  blobUrl: string;
  caption: string;
  uploadedBy: string;
}): Promise<ActionResult<{ id: string; createdAt: Date }>> {
  const blobUrl = input.blobUrl.trim();
  const caption = input.caption.trim().slice(0, 140);
  const uploadedBy = input.uploadedBy.trim().slice(0, 60);

  if (!blobUrl) return { ok: false, error: "No photo to add." };

  const db = getDb();
  try {
    const [inserted] = await db
      .insert(albumPhotos)
      .values({ blobUrl, caption: caption || null, uploadedBy: uploadedBy || null })
      .returning({ id: albumPhotos.id, createdAt: albumPhotos.createdAt });
    revalidatePath("/");
    return { ok: true, data: inserted };
  } catch {
    return { ok: false, error: "Could not save that photo — try again." };
  }
}
```

- [ ] **Step 2: Wire the upload tile into `PhotosTab.tsx`**

Replace the file:

```tsx
"use client";

import { useState, useTransition } from "react";
import PhotoUploader from "@/components/PhotoUploader";
import { addAlbumPhoto } from "@/app/actions";
import type { AlbumPhotoRow } from "@/lib/db/schema";

export default function PhotosTab({
  photos,
  onPhotoAdded,
}: {
  photos: AlbumPhotoRow[];
  onPhotoAdded: (photo: AlbumPhotoRow) => void;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleUploaded = (url: string) => {
    setError("");
    startTransition(async () => {
      const result = await addAlbumPhoto({ blobUrl: url, caption: "", uploadedBy: "" });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPhotoAdded({ id: result.data.id, blobUrl: url, caption: null, uploadedBy: null, createdAt: result.data.createdAt });
    });
  };

  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
        THE ALBUM
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>
        Everyone drops their photos of her here. {photos.length} so far.
      </p>
      {error && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#b3261e" }}>{error}</p>}

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 14 }}>
        {photos.map((p) => (
          <div
            key={p.id}
            style={{
              borderRadius: 12,
              background: "#fdf7f9",
              boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.1)",
              padding: "9px 9px 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 7, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.blobUrl} alt={p.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            {p.caption && <div style={{ padding: "9px 2px 11px", fontSize: 11, color: "#8a5875" }}>{p.caption}</div>}
          </div>
        ))}
        <div style={{ position: "relative", minHeight: 150 }}>
          <PhotoUploader onUploaded={handleUploaded} placeholder={"DROP YOUR\nPHOTOS"} dashed radius={12} />
        </div>
      </div>
    </div>
  );
}
```

Note: `PhotoUploader`'s placeholder text renders as a single `<span>`, so a literal `\n` won't produce a line break the way the original two-line "DROP YOUR / PHOTOS" label did — that's a cosmetic simplification, not a bug. If you want the exact two-line look back, split it into two `<span>` siblings inside `PhotoUploader`'s label block instead of one, or pass `placeholder="drop your photos"` (lowercase, one line) as a simpler equivalent. Either is fine; pick one when you hit this step.

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Go to the Photos tab, click the "+" tile, choose an image. Expected: after a brief "uploading…" state, the new photo appears in the grid. Go to Home tab: expected the same photo shows in the album preview (first 4). Reload the page: expected the photo persists. Open the Vercel dashboard's Blob store browser and confirm the object exists there too.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts components/tabs/PhotosTab.tsx
git commit -m "Add addAlbumPhoto Server Action; album is now a real shared gallery

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Guestbook photo attachments

**Files:**
- Modify: `app/actions.ts` (extend `postMessage`)
- Modify: `components/AudreySite.tsx`
- Modify: `components/tabs/GuestbookTab.tsx`

**Interfaces:**
- Consumes: `PhotoUploader` from Task 8.
- Changes: `postMessage`'s input type grows to `{ name: string; relation: string; body: string; photoUrls: string[] }`.

- [ ] **Step 1: Extend `postMessage` in `app/actions.ts`**

Add `guestbookPhotos` to the schema import:

```ts
import { albumPhotos, guestbookMessages, guestbookPhotos, playlistTracks } from "@/lib/db/schema";
```

Replace the `postMessage` function:

```ts
export async function postMessage(input: {
  name: string;
  relation: string;
  body: string;
  photoUrls: string[];
}): Promise<ActionResult<{ id: string; createdAt: Date }>> {
  const name = input.name.trim().slice(0, 60);
  const relation = input.relation.trim().slice(0, 60);
  const body = input.body.trim().slice(0, 2000);
  const photoUrls = input.photoUrls.slice(0, 3);

  if (!name || !body) {
    return { ok: false, error: "Need a name and a note before we can post it." };
  }

  const db = getDb();
  let inserted: { id: string; createdAt: Date };
  try {
    [inserted] = await db
      .insert(guestbookMessages)
      .values({ name, relation: relation || null, body })
      .returning({ id: guestbookMessages.id, createdAt: guestbookMessages.createdAt });
  } catch {
    return { ok: false, error: "Could not post that message — try again in a moment." };
  }

  // Best-effort: the message itself is already saved even if this fails —
  // acceptable for this low-stakes site rather than adding a real
  // transaction for it.
  if (photoUrls.length) {
    try {
      await db.insert(guestbookPhotos).values(
        photoUrls.map((blobUrl, i) => ({ messageId: inserted.id, blobUrl, sortOrder: i }))
      );
    } catch {
      // Message posted without its photos.
    }
  }

  revalidatePath("/");
  return { ok: true, data: inserted };
}
```

- [ ] **Step 2: Add attach-photo state to `AudreySite.tsx` and pass it through**

Add state near the other form fields:

```tsx
const [formPhotoUrls, setFormPhotoUrls] = useState<string[]>([]);
```

Update the `postMessage` callback to send and then reset `photoUrls`:

```tsx
const postMessage = useCallback(() => {
  if (!formName.trim() || !formBody.trim()) {
    setNotice("Need a name and a note before we can post it.");
    return;
  }
  const name = formName.trim();
  const relation = formRelation.trim();
  const body = formBody.trim();
  const photoUrls = formPhotoUrls;
  setNotice("Posting…");
  startTransition(async () => {
    const result = await postMessageAction({ name, relation, body, photoUrls });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setMessages((m) => [
      { id: result.data.id, name, relation: relation || null, body, likes: 0, createdAt: result.data.createdAt, photoUrls },
      ...m,
    ]);
    setFormName("");
    setFormRelation("");
    setFormBody("");
    setFormPhotoUrls([]);
    setNotice("Posted — she'll see it on the 20th.");
  });
}, [formName, formRelation, formBody, formPhotoUrls]);
```

Pass the new props down to `GuestbookTab`:

```tsx
<GuestbookTab
  messages={messages}
  liked={liked}
  onToggleLike={toggleLike}
  formName={formName}
  formRelation={formRelation}
  formBody={formBody}
  formPhotoUrls={formPhotoUrls}
  onAddFormPhoto={(url) => setFormPhotoUrls((urls) => [...urls, url].slice(0, 3))}
  onRemoveFormPhoto={(url) => setFormPhotoUrls((urls) => urls.filter((u) => u !== url))}
  onFormNameChange={setFormName}
  onFormRelationChange={setFormRelation}
  onFormBodyChange={setFormBody}
  notice={notice}
  onPostMessage={postMessage}
/>
```

- [ ] **Step 3: Wire the attach UI in `GuestbookTab.tsx`**

Add the import:

```tsx
import PhotoUploader from "@/components/PhotoUploader";
```

Add the new props to the component signature:

```tsx
formPhotoUrls,
onAddFormPhoto,
onRemoveFormPhoto,
```

with types:

```tsx
formPhotoUrls: string[];
onAddFormPhoto: (url: string) => void;
onRemoveFormPhoto: (url: string) => void;
```

Replace the static "+ ADD PHOTOS (3 MAX)" block in the form with:

```tsx
<div style={{ display: "flex", gap: 8 }}>
  {formPhotoUrls.map((url) => (
    <div key={url} style={{ position: "relative", width: 60, height: 60, borderRadius: 8, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <button
        onClick={() => onRemoveFormPhoto(url)}
        aria-label="Remove photo"
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 16,
          height: 16,
          lineHeight: "16px",
          textAlign: "center",
          borderRadius: "50%",
          border: "none",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 10,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  ))}
  {formPhotoUrls.length < 3 && (
    <div style={{ width: 60, height: 60 }}>
      <PhotoUploader onUploaded={onAddFormPhoto} placeholder="+" dashed radius={8} />
    </div>
  )}
</div>
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Go to Guestbook, attach 1–3 photos via the new tile before posting, fill in name/body, click "Post it". Expected: the posted message shows the attached photo(s) beneath its text, and the form's attach row clears. Try attaching a 4th photo: expected the upload tile disappears once 3 are attached (only the "×" remove buttons are available). Reload: expected photos persist on the posted message.

- [ ] **Step 5: Commit**

```bash
git add app/actions.ts components/AudreySite.tsx components/tabs/GuestbookTab.tsx
git commit -m "Wire up guestbook photo attachments (up to 3 per message)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Admin auth

**Files:**
- Create: `lib/admin.ts`
- Modify: `app/actions.ts`
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminLoginForm.tsx`

**Interfaces:**
- Produces: `ADMIN_COOKIE`, `isAdmin(): Promise<boolean>` (from `lib/admin.ts`); `adminLogin(passcode: string): Promise<ActionResult<null>>`, `adminLogout(): Promise<ActionResult<null>>` — consumed by Task 12's `AdminDashboard` and by `deleteMessage`/`deleteSong`/`deleteAlbumPhoto`.

- [ ] **Step 1: Write the shared admin-cookie helper**

`lib/admin.ts`:

```ts
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "audreyware_admin";

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "granted";
}
```

- [ ] **Step 2: Add `adminLogin`/`adminLogout` to `app/actions.ts`**

Add imports:

```ts
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin";
```

Append:

```ts
export async function adminLogin(passcode: string): Promise<ActionResult<null>> {
  if (!process.env.ADMIN_PASSCODE) {
    return { ok: false, error: "Admin passcode is not configured." };
  }
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return { ok: false, error: "Incorrect passcode." };
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true, data: null };
}

export async function adminLogout(): Promise<ActionResult<null>> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return { ok: true, data: null };
}
```

- [ ] **Step 3: Write the login form**

`app/admin/AdminLoginForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@/app/actions";

export default function AdminLoginForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = () => {
    setPending(true);
    setError("");
    startTransition(async () => {
      const result = await adminLogin(passcode);
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ maxWidth: 320, margin: "80px auto", padding: 24, fontFamily: "Verdana, Geneva, sans-serif" }}>
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>Admin</h1>
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="passcode"
        style={{ width: "100%", padding: 10, marginBottom: 10, boxSizing: "border-box" }}
      />
      <button onClick={submit} disabled={pending} style={{ width: "100%", padding: 10 }}>
        {pending ? "Checking…" : "Enter"}
      </button>
      {error && <div style={{ marginTop: 10, color: "#b3261e", fontSize: 12 }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Write the admin page (auth gate only for now)**

`app/admin/page.tsx`:

```tsx
import { isAdmin } from "@/lib/admin";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLoginForm />;
  }
  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "Verdana, Geneva, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Admin</h1>
      <p>Logged in. Delete tooling lands in the next task.</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run dev
```

Visit `http://localhost:3000/admin`. Expected: passcode form. Enter the wrong passcode: expected "Incorrect passcode." Enter the value of `ADMIN_PASSCODE` from `.env.local`: expected the page switches to "Logged in." Reload the page: expected it stays logged in (cookie persisted). Open dev tools → Application → Cookies and confirm `audreyware_admin` is `HttpOnly`.

- [ ] **Step 6: Commit**

```bash
git add lib/admin.ts app/actions.ts app/admin/page.tsx app/admin/AdminLoginForm.tsx
git commit -m "Add passcode-gated admin auth

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Admin delete tooling

**Files:**
- Modify: `app/actions.ts`
- Modify: `app/admin/page.tsx`
- Create: `app/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `isAdmin()` from `lib/admin.ts`; `getMessages`, `getPlaylist`, `getAlbumPhotos` from `lib/db/queries.ts`.
- Produces: `deleteMessage(id: string)`, `deleteSong(id: string)`, `deleteAlbumPhoto(id: string)` — each `Promise<ActionResult<null>>`.

- [ ] **Step 1: Add delete actions to `app/actions.ts`**

Add the `del` import from Blob and `isAdmin`:

```ts
import { del } from "@vercel/blob";
import { isAdmin } from "@/lib/admin";
```

Append:

```ts
export async function deleteMessage(id: string): Promise<ActionResult<null>> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const db = getDb();
  const photos = await db.select().from(guestbookPhotos).where(eq(guestbookPhotos.messageId, id));
  await Promise.all(photos.map((p) => del(p.blobUrl).catch(() => {})));
  await db.delete(guestbookMessages).where(eq(guestbookMessages.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function deleteSong(id: string): Promise<ActionResult<null>> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const db = getDb();
  await db.delete(playlistTracks).where(eq(playlistTracks.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function deleteAlbumPhoto(id: string): Promise<ActionResult<null>> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const db = getDb();
  const [photo] = await db.select().from(albumPhotos).where(eq(albumPhotos.id, id));
  if (photo) await del(photo.blobUrl).catch(() => {});
  await db.delete(albumPhotos).where(eq(albumPhotos.id, id));
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: null };
}
```

`guestbook_photos` rows are deleted automatically by the schema's `onDelete: "cascade"` when the parent message is deleted — the code above only has to clean up the Blob objects themselves (Postgres cascade doesn't touch Blob storage) before deleting the message row.

- [ ] **Step 2: Write the dashboard**

`app/admin/AdminDashboard.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogout, deleteAlbumPhoto, deleteMessage, deleteSong, type ActionResult } from "@/app/actions";
import type { MessageWithPhotos } from "@/lib/db/queries";
import type { AlbumPhotoRow, PlaylistTrackRow } from "@/lib/db/schema";

export default function AdminDashboard({
  messages,
  playlist,
  albumPhotos,
}: {
  messages: MessageWithPhotos[];
  playlist: PlaylistTrackRow[];
  albumPhotos: AlbumPhotoRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (action: () => Promise<ActionResult<unknown>>) => {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24, fontFamily: "Verdana, Geneva, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20 }}>Admin</h1>
        <button onClick={() => run(adminLogout)} disabled={isPending}>
          Log out
        </button>
      </div>
      {error && <div style={{ color: "#b3261e", fontSize: 12, marginBottom: 16 }}>{error}</div>}

      <h2 style={{ fontSize: 15 }}>Guestbook messages ({messages.length})</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {messages.map((m) => (
          <li key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <span>
              <strong>{m.name}</strong>
              {m.relation ? ` (${m.relation})` : ""}: {m.body.slice(0, 80)}
              {m.photoUrls.length > 0 ? ` — ${m.photoUrls.length} photo(s)` : ""}
            </span>
            <button disabled={isPending} onClick={() => run(() => deleteMessage(m.id))}>
              Delete
            </button>
          </li>
        ))}
        {messages.length === 0 && <li style={{ padding: "8px 0", color: "#888" }}>No messages yet.</li>}
      </ul>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Playlist ({playlist.length})</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {playlist.map((t) => (
          <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <span>
              {t.title} — {t.artist || "—"} (added by {t.addedBy || "anonymous"})
            </span>
            <button disabled={isPending} onClick={() => run(() => deleteSong(t.id))}>
              Delete
            </button>
          </li>
        ))}
        {playlist.length === 0 && <li style={{ padding: "8px 0", color: "#888" }}>No songs yet.</li>}
      </ul>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Album photos ({albumPhotos.length})</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {albumPhotos.map((p) => (
          <li key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #eee" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.blobUrl} alt="" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 4 }} />
            <span style={{ flex: 1 }}>{p.caption || "(no caption)"}</span>
            <button disabled={isPending} onClick={() => run(() => deleteAlbumPhoto(p.id))}>
              Delete
            </button>
          </li>
        ))}
        {albumPhotos.length === 0 && <li style={{ padding: "8px 0", color: "#888" }}>No photos yet.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Wire the dashboard into `app/admin/page.tsx`**

Replace the file:

```tsx
import { isAdmin } from "@/lib/admin";
import { getAlbumPhotos, getMessages, getPlaylist } from "@/lib/db/queries";
import AdminDashboard from "./AdminDashboard";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLoginForm />;
  }

  const [messages, playlist, albumPhotos] = await Promise.all([getMessages(), getPlaylist(), getAlbumPhotos()]);

  return <AdminDashboard messages={messages} playlist={playlist} albumPhotos={albumPhotos} />;
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Log into `/admin` with the real passcode. Expected: lists of messages/songs/photos created during earlier tasks' testing. Delete one of each. Expected: each disappears from the admin list immediately, and also disappears from the main site (`/`) on reload. For a deleted album photo, check the Vercel Blob store dashboard: expected the underlying object is gone too (may take up to a minute per Blob's CDN cache note).

- [ ] **Step 5: Commit**

```bash
git add app/actions.ts app/admin/page.tsx app/admin/AdminDashboard.tsx
git commit -m "Add admin delete tooling for messages, songs, and photos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Cleanup and full walkthrough

**Files:**
- Delete: `components/PhotoSlot.tsx`

**Interfaces:** none new — this task only removes dead code and verifies the whole feature end-to-end.

- [ ] **Step 1: Confirm nothing still imports `PhotoSlot`**

```bash
grep -rn "PhotoSlot" --include="*.tsx" --include="*.ts" app components lib
```

Expected: no matches (Task 4 removed the last usages in `HomeTab`/`GuestbookTab`/`PhotosTab`).

- [ ] **Step 2: Delete the dead file**

```bash
git rm components/PhotoSlot.tsx
```

- [ ] **Step 3: Full manual walkthrough**

```bash
npm run dev
```

Starting from a clean browser profile (or an incognito window, so no `liked` localStorage carries over), walk every flow once, end to end:

1. Home tab loads with current guestbook/playlist/album counts and no console errors.
2. Guestbook: post a message with 2 attached photos. It appears immediately with photos.
3. Guestbook: like, then unlike, a message. Count updates both times.
4. Sounds: add a song. It appears in "THE BIRTHDAY MIX" with a gradient swatch.
5. Photos: upload a photo directly to the album. It appears in the grid and on the Home tab's preview.
6. Reload the page after each of the above — confirm everything persisted (proves it's server-backed, not local state).
7. `/admin`: log in, delete one message, one song, one photo. Confirm each is gone from the main site.
8. `/admin`: log out, confirm the passcode form reappears.

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors (warnings acceptable if they predate this work).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove dead PhotoSlot component after localStorage-photo migration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Deploy**

```bash
vercel --prod
```

Expected: build succeeds (env vars are already provisioned from Task 1) and the production URL shows the live site. Repeat the Step 3 walkthrough once against the production URL before sharing the link.

---

## Self-review notes

- **Spec coverage:** every spec section has a task — data model (Task 3), reads (Task 4), `postMessage`/likes/`addSong` (Tasks 5–7), Blob upload pipeline (Task 8), album gallery (Task 9), guestbook photos (Task 10), admin auth + delete (Tasks 11–12), cleanup (Task 13), provisioning (Task 1).
- **Deviation from the spec, called out explicitly:** the spec's `postMessage`/`guestbook_photos` insert was described as one Drizzle transaction. `drizzle-orm/neon-http`'s transaction support doesn't reliably support reading a value from one statement (the new message's id) and using it in a dependent statement within the same batch, so Task 10 instead does two sequential inserts with the tradeoff spelled out in a code comment (message can end up without its photos on a rare second-insert failure — acceptable for this site).
- **Deviation, likes semantics:** the spec named the action `toggleLike`; since there's no per-visitor identity server-side, Task 6 implements it as `setMessageLike(id, liked)` (increment or decrement, floored at 0) driven by the client's own `liked` flag — same visible behavior, more accurate name.
- **Type consistency check:** `MessageWithPhotos` (Task 4) is used identically in `AudreySite.tsx`, `HomeTab.tsx`, `GuestbookTab.tsx`, and `AdminDashboard.tsx`. `ActionResult<T>` (Task 5) is reused for every action through Task 12. `PhotoUploader`'s `onUploaded: (url: string) => void` signature (Task 8) matches its two call sites in Tasks 9 and 10.
