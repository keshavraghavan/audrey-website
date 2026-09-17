# Guestbook Persistence + Blob Photo Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Guestbook tab's `localStorage`-only mock with a real shared Postgres-backed guestbook, and make the currently-inert "+ ADD PHOTOS (3 MAX)" button actually upload photos to Vercel Blob and attach them to a message.

**Architecture:** Neon Postgres (via Drizzle, reusing the existing `lib/db` module) becomes the source of truth for guestbook messages, read server-side in `app/page.tsx` and passed into the existing client component tree. Photos upload directly from the browser to Vercel Blob via `@vercel/blob/client`'s `upload()`, authorized by a token-issuing Route Handler — image bytes never pass through a Server Action. Posting a message and toggling a like are both Server Actions in `app/actions.ts`, following the exact pattern `addTrackToMix`/`connectSpotify` already established.

**Tech Stack:** Next.js 16.3.0 App Router, Drizzle ORM (`drizzle-orm/neon-http`) + `@neondatabase/serverless`, `@vercel/blob` (client + server), React 19.

**Spec:** `docs/superpowers/specs/2026-09-17-guestbook-persistence-design.md`

## Global Constraints

- No passphrase gate on posting — stays open to anyone with the site link (spec: "Decisions locked in").
- Scope is guestbook messages + photos only. Admin moderation panel and the album/photos-tab gallery conversion are explicitly out of scope for this plan (spec: "Decisions locked in" / "Out of scope").
- Likes stay client-tracked in `localStorage` for "have I liked this" — no accounts exist to enforce real dedup (spec: "Decisions locked in").
- A failed individual photo upload never blocks the post — the message posts with whichever photos succeeded (spec: "Decisions locked in").
- Photos are a `text[]` column on `guestbook_messages`, not a separate join table — no per-photo metadata is needed and the 3-photo cap is enforced in the Server Action, not the schema (spec: "Why this shape").
- `meta` (time-ago) and `tint`/`swatch` are never stored — derived at read time from `created_at` and `id` (spec: "Decisions locked in").
- The 4 existing `SEED_MESSAGES` are migrated into real rows via a one-off script, then the in-app seed array is removed entirely (spec: "Decisions locked in" / overriding the 2026-08-25 spec).
- No test runner is introduced. Verification is manual against the real Neon/Blob resources, matching both prior specs for this repo (spec: "Testing").

---

## Task 1: Guestbook database schema + read helper

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/index.ts`

**Interfaces:**
- Produces: `guestbookMessages` (Drizzle table), `GuestbookMessageRow` (type, `{ id: string; name: string; body: string; photoUrls: string[]; likes: number; createdAt: Date }`), `getGuestbookMessages(): Promise<GuestbookMessageRow[]>` — all consumed by Task 2 and Task 4.

- [ ] **Step 1: Add the `guestbookMessages` table to the schema**

Open `lib/db/schema.ts`. Change the import line at the top from:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
```

to:

```ts
import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
```

Then append this to the end of the file:

```ts

export const guestbookMessages = pgTable("guestbook_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  body: text("body").notNull(),
  // 0-3 Blob URLs. The 3-photo cap is enforced in the Server Action, not here.
  photoUrls: text("photo_urls").array().notNull().default([]),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuestbookMessageRow = typeof guestbookMessages.$inferSelect;
```

- [ ] **Step 2: Add the read helper**

Open `lib/db/index.ts`. Change the import line from:

```ts
import { tracks, spotifyConnection, type TrackRow, type SpotifyConnectionRow } from "./schema";
```

to:

```ts
import { tracks, spotifyConnection, guestbookMessages, type TrackRow, type SpotifyConnectionRow, type GuestbookMessageRow } from "./schema";
```

Then append this at the end of the file:

```ts

export async function getGuestbookMessages(): Promise<GuestbookMessageRow[]> {
  return getDb().select().from(guestbookMessages).orderBy(desc(guestbookMessages.createdAt));
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Nothing imports `guestbookMessages`/`getGuestbookMessages` yet, so this is purely additive.)

- [ ] **Step 4: Push the schema to Neon**

Run: `npm run db:push`
Expected: drizzle-kit reports it created the `guestbook_messages` table (it may print a confirmation prompt since this is a brand-new table with no ambiguity — accept the default/only option). No errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/index.ts
git commit -m "feat: add guestbook_messages table and read helper"
```

---

## Task 2: One-off seed script for the existing guestbook messages

**Files:**
- Create: `scripts/seed-guestbook.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getDb` (from `lib/db/index.ts`, Task 1), `guestbookMessages` (from `lib/db/schema.ts`, Task 1).
- Produces: nothing other components depend on — this is a one-off, run-once script, not part of the app's runtime code (spec: "Component changes").

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-guestbook.ts`. Uses relative imports (not the `@/` alias) since this runs standalone via `tsx`, outside Next.js's bundler-resolved path aliases:

```ts
import { getDb } from "../lib/db";
import { guestbookMessages } from "../lib/db/schema";

// The 4 messages the guestbook has always shipped with (previously
// `SEED_MESSAGES` in lib/audrey-data.ts, which this script replaces as the
// source of truth — run once, then the seed array is deleted in Task 4).
const SEED = [
  {
    name: "Priya",
    body: 'First memory: you at the kitchen table at 1am, three books open, telling me you were "almost done." You were on page nine of all three. Happiest birthday, my favorite over-committer.',
    likes: 7,
  },
  {
    name: "Dad",
    body: "Twenty-four years ago you arrived two weeks late, already on your own schedule. Nothing has changed. We love you.",
    likes: 12,
  },
  {
    name: "Marcus",
    body: "You have never once let us pick the book and honestly the record speaks for itself. 24 looks good on you.",
    likes: 5,
  },
  {
    name: "Jules",
    body: "First time I met you, you asked what I was reading before you asked my name. Still the best introduction I've ever gotten.",
    likes: 9,
  },
];

async function main() {
  const db = getDb();
  for (const message of SEED) {
    await db.insert(guestbookMessages).values({
      name: message.name,
      body: message.body,
      likes: message.likes,
      photoUrls: [],
    });
  }
  console.log(`Inserted ${SEED.length} seed guestbook messages.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
```

- [ ] **Step 2: Add a convenience script**

Open `package.json`. In `"scripts"`, add this line after `"db:studio"`:

```json
    "db:seed-guestbook": "dotenv -e .env.local -- tsx scripts/seed-guestbook.ts"
```

(Match the existing comma placement so the JSON stays valid — `db:studio`'s line now ends with a comma, and `db:seed-guestbook` is the new last entry.)

- [ ] **Step 3: Run it**

Run: `npm run db:seed-guestbook`
Expected: prints `Inserted 4 seed guestbook messages.` and exits 0. This only needs to run once — running it again will insert 4 duplicate rows (there's no uniqueness constraint on name/body), so don't re-run it after this step. Full visual confirmation happens in Task 4's end-to-end check, once the UI can actually display these rows.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-guestbook.ts package.json
git commit -m "feat: seed guestbook_messages with the existing 4 messages"
```

---

## Task 3: Blob store provisioning + upload token route

**Files:**
- Create: `app/api/blob/upload/route.ts`

**Interfaces:**
- Produces: `POST /api/blob/upload` — the `handleUploadUrl` Task 4's client-side `upload()` call points at.

- [ ] **Step 1: Provision a Blob store (human step — do not delegate to a coding subagent)**

This creates a billable account-level resource, so run it yourself rather than have an agent run it. In this project's directory:

```
!vercel blob create-store audrey-website-photos
```

- [ ] **Step 2: Confirm the token synced, and connect the store if it didn't**

```
!vercel env ls
```

Look for `BLOB_READ_WRITE_TOKEN` in the list. If it's there, skip to Step 3. If it's **not** there, the store was created but not yet connected to this Vercel project — go to `https://vercel.com/dashboard` → your project → **Storage** tab → connect the `audrey-website-photos` store to this project, then re-run `!vercel env ls` to confirm.

- [ ] **Step 3: Pull the token locally**

```
!vercel env pull .env.local --yes
```

This overwrites `.env.local` with everything currently on Vercel — it will **not** drop your existing `DATABASE_URL`/`SPOTIFY_*`/`CONNECT_PASSPHRASE` values as long as those are also set on Vercel (they should be, from the earlier Spotify pass). Confirm after pulling:

```bash
grep -c '^BLOB_READ_WRITE_TOKEN=' .env.local
```

Expected: `1`.

- [ ] **Step 4: Write the upload token route**

Create `app/api/blob/upload/route.ts`:

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
        maximumSizeInBytes: 15 * 1024 * 1024, // phone-camera photos
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("Blob upload token generation failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Smoke-test the route exists and rejects malformed input**

With the dev server running (`npm run dev` in another terminal):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/blob/upload -H "Content-Type: application/json" -d '{}'
```

Expected: `400` (malformed body — not a real `HandleUploadBody` shape). A `404` would mean the route file is misplaced; a `500` with an unhandled-exception stack means something in the handler itself is broken. Full happy-path verification (an actual upload succeeding) happens in Task 4, once there's a UI to drive it from.

- [ ] **Step 7: Commit**

```bash
git add app/api/blob/upload/route.ts
git commit -m "feat: add Vercel Blob client-upload token route"
```

---

## Task 4: Guestbook data transform, Server Actions, and UI wiring

**Files:**
- Modify: `lib/audrey-data.ts`
- Modify: `app/actions.ts`
- Modify: `app/page.tsx`
- Modify: `components/AudreySite.tsx`
- Modify: `components/tabs/GuestbookTab.tsx`

**Interfaces:**
- Consumes: `getGuestbookMessages` (Task 1), `upload` from `@vercel/blob/client` pointed at `/api/blob/upload` (Task 3).
- Produces: `toGuestbookMessage(row): GuestbookMessage` (used by both `app/page.tsx` and `app/actions.ts`), `postGuestbookMessage(input): Promise<PostGuestbookMessageResult>`, `toggleGuestbookLike(id, liked): Promise<void>`.

This task is one cohesive unit — the type change, the actions, and the two components that consume them all have to land together for the app to build, so it's committed as a single step at the end rather than mid-way.

- [ ] **Step 1: Rewrite the guestbook types and add the row→view transform**

Open `lib/audrey-data.ts`. Replace the `MessageTint`/`GuestbookMessage`/`SEED_MESSAGES` block (currently lines 14-65 — from `export type MessageTint` through the closing `];` of `SEED_MESSAGES`) with:

```ts
export type MessageTint = "pink" | "teal" | "gold";

const TINTS: MessageTint[] = ["pink", "teal", "gold"];

const SWATCHES: Record<MessageTint, string> = {
  pink: "linear-gradient(135deg, #ff8ec9, #d6006e)",
  teal: "linear-gradient(135deg, #7de3e3, #009a9a)",
  gold: "linear-gradient(135deg, #ffe680, #ffb300)",
};

// Real messages have no UI field for picking a color, so the tint is a
// deterministic hash of the message id — stable across reloads without
// storing it.
function deriveTint(id: string): MessageTint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export type GuestbookMessage = {
  id: string;
  name: string;
  meta: string;
  swatch: string;
  tint: MessageTint;
  likes: number;
  body: string;
  photoUrls: string[];
};

type GuestbookMessageSource = {
  id: string;
  name: string;
  body: string;
  photoUrls: string[];
  likes: number;
  createdAt: Date;
};

export function toGuestbookMessage(row: GuestbookMessageSource): GuestbookMessage {
  const tint = deriveTint(row.id);
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    photoUrls: row.photoUrls,
    likes: row.likes,
    tint,
    swatch: SWATCHES[tint],
    meta: formatTimeAgo(row.createdAt),
  };
}
```

Note what's deleted: the old `SEED_MESSAGES` array and its 4 hand-written entries are gone entirely — Task 2's seed script already put them in Postgres.

- [ ] **Step 2: Add the Server Actions**

Open `app/actions.ts`. Change the imports at the top from:

```ts
import { getDb, getSpotifyConnection } from "@/lib/db";
import { tracks, spotifyConnection } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthorizeUrl, refreshAccessToken, addTracksToPlaylist } from "@/lib/spotify";
import { eq } from "drizzle-orm";
```

to:

```ts
import { getDb, getSpotifyConnection } from "@/lib/db";
import { tracks, spotifyConnection, guestbookMessages } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthorizeUrl, refreshAccessToken, addTracksToPlaylist } from "@/lib/spotify";
import { eq, sql } from "drizzle-orm";
import { toGuestbookMessage, type GuestbookMessage } from "@/lib/audrey-data";
```

Then append this at the end of the file:

```ts

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

  try {
    const [row] = await getDb()
      .insert(guestbookMessages)
      .values({ name, body, photoUrls: input.photoUrls.slice(0, 3) })
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
```

- [ ] **Step 3: Wire the server-side read into the page**

Open `app/page.tsx`. Replace its entire contents with:

```tsx
import AudreySite from "@/components/AudreySite";
import { getTracks, getGuestbookMessages } from "@/lib/db";
import { toGuestbookMessage, type GuestbookMessage } from "@/lib/audrey-data";

export default async function Page() {
  let tracks: Awaited<ReturnType<typeof getTracks>> = [];
  try {
    tracks = await getTracks();
  } catch (err) {
    console.error("Failed to load tracks:", err);
  }

  let messages: GuestbookMessage[] = [];
  try {
    const rows = await getGuestbookMessages();
    messages = rows.map(toGuestbookMessage);
  } catch (err) {
    console.error("Failed to load guestbook messages:", err);
  }

  return <AudreySite initialTracks={tracks} initialMessages={messages} />;
}
```

- [ ] **Step 4: Rewire `AudreySite.tsx`**

Open `components/AudreySite.tsx`.

Change the imports — replace:

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

with:

```tsx
import { upload } from "@vercel/blob/client";
import { addTrackToMix, postGuestbookMessage, toggleGuestbookLike } from "@/app/actions";
import type { SpotifySearchResult } from "@/lib/spotify";
import {
  ACCENT,
  AGE,
  BIRTHDAY,
  NAME,
  TABS,
  type GuestbookMessage,
  type Tab,
  type Track,
} from "@/lib/audrey-data";
```

Change `SavedState` — replace:

```tsx
type SavedState = {
  messages?: GuestbookMessage[];
  liked?: Record<string, boolean>;
};
```

with:

```tsx
type SavedState = {
  liked?: Record<string, boolean>;
};
```

Change the component signature and initial state — replace:

```tsx
export default function AudreySite({ initialTracks }: { initialTracks: Track[] }) {
  const [tab, setTab] = useState<Tab>("home");
  const [messages, setMessages] = useState<GuestbookMessage[]>(SEED_MESSAGES);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [playlist, setPlaylist] = useState<Track[]>(initialTracks);
  const [hydrated, setHydrated] = useState(false);

  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [notice, setNotice] = useState("");
```

with:

```tsx
export default function AudreySite({
  initialTracks,
  initialMessages,
}: {
  initialTracks: Track[];
  initialMessages: GuestbookMessage[];
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [messages, setMessages] = useState<GuestbookMessage[]>(initialMessages);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [playlist, setPlaylist] = useState<Track[]>(initialTracks);
  const [hydrated, setHydrated] = useState(false);

  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
```

Change the hydration effect — replace:

```tsx
    try {
      const saved: SavedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.messages?.length) setMessages(saved.messages);
      if (saved.liked) setLiked(saved.liked);
    } catch {
```

with:

```tsx
    try {
      const saved: SavedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.liked) setLiked(saved.liked);
    } catch {
```

Change the save effect — replace:

```tsx
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, liked }));
    } catch {
      // Storage full or disabled — the session still works, it just won't persist.
    }
  }, [messages, liked, hydrated]);
```

with:

```tsx
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ liked }));
    } catch {
      // Storage full or disabled — the session still works, it just won't persist.
    }
  }, [liked, hydrated]);
```

Change `toggleLike` and `postMessage`, and add `addPendingPhotos` — replace:

```tsx
  const goTo = useCallback((t: Tab) => setTab(t), []);
  const toggleLike = useCallback((id: string) => setLiked((s) => ({ ...s, [id]: !s[id] })), []);

  const postMessage = useCallback(() => {
    if (!formName.trim() || !formBody.trim()) {
      setNotice("Need a name and a note before we can post it.");
      return;
    }
    const msg: GuestbookMessage = {
      id: "u" + Date.now(),
      name: formName.trim(),
      meta: "just now",
      swatch: "linear-gradient(135deg, #ff8ec9, #d6006e)",
      tint: "pink",
      likes: 0,
      body: formBody.trim(),
    };
    setMessages((m) => [msg, ...m]);
    setFormName("");
    setFormBody("");
    setNotice("Posted — she'll see it on the 20th.");
  }, [formName, formBody]);
```

with:

```tsx
  const goTo = useCallback((t: Tab) => setTab(t), []);

  const toggleLike = useCallback(
    (id: string) => {
      const nextLiked = !liked[id];
      setLiked((s) => ({ ...s, [id]: nextLiked }));
      setMessages((msgs) => msgs.map((m) => (m.id === id ? { ...m, likes: m.likes + (nextLiked ? 1 : -1) } : m)));
      toggleGuestbookLike(id, nextLiked).catch((err) => console.error("toggleGuestbookLike failed:", err));
    },
    [liked],
  );

  const addPendingPhotos = useCallback(
    async (files: FileList) => {
      const remaining = 3 - pendingPhotoUrls.length;
      if (remaining <= 0) return;
      const toUpload = Array.from(files).slice(0, remaining);
      setUploadingPhotos(true);
      const uploaded: string[] = [];
      for (const file of toUpload) {
        try {
          const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/blob/upload" });
          uploaded.push(blob.url);
        } catch (err) {
          // Partial-failure decision: drop the one that failed, keep going —
          // never blocks the post over one bad photo.
          console.error("Photo upload failed:", err);
        }
      }
      setPendingPhotoUrls((urls) => [...urls, ...uploaded]);
      setUploadingPhotos(false);
    },
    [pendingPhotoUrls.length],
  );

  const postMessage = useCallback(async () => {
    if (!formName.trim() || !formBody.trim()) {
      setNotice("Need a name and a note before we can post it.");
      return;
    }
    const result = await postGuestbookMessage({
      name: formName.trim(),
      body: formBody.trim(),
      photoUrls: pendingPhotoUrls,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setMessages((m) => [result.message, ...m]);
    setFormName("");
    setFormBody("");
    setPendingPhotoUrls([]);
    setNotice("Posted — she'll see it on the 20th.");
  }, [formName, formBody, pendingPhotoUrls]);
```

Finally, pass the new props to `GuestbookTab` — replace:

```tsx
          {tab === "guestbook" && (
            <GuestbookTab
              messages={messages}
              liked={liked}
              onToggleLike={toggleLike}
              formName={formName}
              formBody={formBody}
              onFormNameChange={setFormName}
              onFormBodyChange={setFormBody}
              notice={notice}
              onPostMessage={postMessage}
            />
          )}
```

with:

```tsx
          {tab === "guestbook" && (
            <GuestbookTab
              messages={messages}
              liked={liked}
              onToggleLike={toggleLike}
              formName={formName}
              formBody={formBody}
              onFormNameChange={setFormName}
              onFormBodyChange={setFormBody}
              notice={notice}
              onPostMessage={postMessage}
              photoUrls={pendingPhotoUrls}
              uploadingPhotos={uploadingPhotos}
              onAddPhotos={addPendingPhotos}
            />
          )}
```

- [ ] **Step 5: Type-check (expect GuestbookTab prop errors — fixed in the next step)**

Run: `npx tsc --noEmit`
Expected: errors in `components/tabs/GuestbookTab.tsx` — it doesn't accept `photoUrls`/`uploadingPhotos`/`onAddPhotos` yet, and still reads the now-gone `m.photos`. That's expected at this point in the task.

- [ ] **Step 6: Rewire `GuestbookTab.tsx`**

Open `components/tabs/GuestbookTab.tsx`.

Remove the now-unused import — replace:

```tsx
import PhotoSlot from "@/components/PhotoSlot";
import type { GuestbookMessage, MessageTint } from "@/lib/audrey-data";
```

with:

```tsx
import type { GuestbookMessage, MessageTint } from "@/lib/audrey-data";
```

Add the new props to the function signature — replace:

```tsx
export default function GuestbookTab({
  messages,
  liked,
  onToggleLike,
  formName,
  formBody,
  onFormNameChange,
  onFormBodyChange,
  notice,
  onPostMessage,
}: {
  messages: GuestbookMessage[];
  liked: Record<string, boolean>;
  onToggleLike: (id: string) => void;
  formName: string;
  formBody: string;
  onFormNameChange: (value: string) => void;
  onFormBodyChange: (value: string) => void;
  notice: string;
  onPostMessage: () => void;
}) {
```

with:

```tsx
export default function GuestbookTab({
  messages,
  liked,
  onToggleLike,
  formName,
  formBody,
  onFormNameChange,
  onFormBodyChange,
  notice,
  onPostMessage,
  photoUrls,
  uploadingPhotos,
  onAddPhotos,
}: {
  messages: GuestbookMessage[];
  liked: Record<string, boolean>;
  onToggleLike: (id: string) => void;
  formName: string;
  formBody: string;
  onFormNameChange: (value: string) => void;
  onFormBodyChange: (value: string) => void;
  notice: string;
  onPostMessage: () => void;
  photoUrls: string[];
  uploadingPhotos: boolean;
  onAddPhotos: (files: FileList) => void;
}) {
```

Replace the per-message photo block — replace:

```tsx
                {m.photos && (
                  <div style={{ marginTop: 12, display: "flex", gap: 9 }}>
                    <div style={{ width: 104, height: 78, borderRadius: 8, background: "#cdf3f3", overflow: "hidden" }}>
                      <PhotoSlot id="dad-1" background="#cdf3f3" radius={8} placeholder="photo" />
                    </div>
                    <div style={{ width: 104, height: 78, borderRadius: 8, background: "#ffd9ec", overflow: "hidden" }}>
                      <PhotoSlot id="dad-2" background="#ffd9ec" radius={8} placeholder="photo" />
                    </div>
                  </div>
                )}
```

with:

```tsx
                {m.photoUrls.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 9 }}>
                    {m.photoUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- visitor-uploaded Blob URLs, not a next/image-optimizable local/remote-pattern asset for this pass
                      <img key={url} src={url} alt="" style={{ width: 104, height: 78, borderRadius: 8, objectFit: "cover" }} />
                    ))}
                  </div>
                )}
```

Replace the "+ ADD PHOTOS (3 MAX)" static stub — replace:

```tsx
        <div
          style={{
            borderRadius: 10,
            border: "2px dashed #eeb0cf",
            background: "#f7edf2",
            padding: 12,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-dark)",
            cursor: "pointer",
          }}
        >
          + ADD PHOTOS (3 MAX)
        </div>
```

with:

```tsx
        <label
          style={{
            borderRadius: 10,
            border: "2px dashed #eeb0cf",
            background: "#f7edf2",
            padding: 12,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-dark)",
            cursor: photoUrls.length >= 3 || uploadingPhotos ? "default" : "pointer",
            opacity: photoUrls.length >= 3 ? 0.6 : 1,
            display: "block",
          }}
        >
          {uploadingPhotos ? "UPLOADING…" : photoUrls.length >= 3 ? "3 PHOTOS ATTACHED" : "+ ADD PHOTOS (3 MAX)"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={photoUrls.length >= 3 || uploadingPhotos}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onAddPhotos(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
        {photoUrls.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {photoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- visitor-uploaded Blob URLs, not a next/image-optimizable local/remote-pattern asset for this pass
              <img key={url} src={url} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />
            ))}
          </div>
        )}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual end-to-end verification**

With the dev server running (`npm run dev`):

1. Load `/` and go to the Guestbook tab. Confirm the 4 seeded messages (Priya, Dad, Marcus, Jules) render with plausible "time ago" text and three different tint colors across them — not all identical.
2. Post a text-only message (name + body, no photos). Confirm it appears at the top of the list immediately.
3. **Reload the page in a different browser (or an incognito window)** — confirm the message you just posted is there. This is the actual proof it's shared/server-persisted and not just local state (the old `localStorage` version would fail this check).
4. Post a message with 1-2 attached photos. Confirm the "+ ADD PHOTOS" control shows "UPLOADING…" briefly, then thumbnails appear before you post, and the posted message renders those photos.
5. Click a message's like heart. Confirm the count increments immediately. Reload in the other browser/incognito window from step 3 — confirm the incremented count is visible there too (proves it's a real shared counter, not the old local-only overlay). Click again to unlike — confirm it decrements.
6. Check the terminal running `next dev` for any unexpected errors during the above.

- [ ] **Step 9: Commit**

```bash
git add lib/audrey-data.ts app/actions.ts app/page.tsx components/AudreySite.tsx components/tabs/GuestbookTab.tsx
git commit -m "feat: make the guestbook shared and persistent, with working photo uploads"
```
