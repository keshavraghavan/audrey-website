# AudreyWare 24.0 — real backend design

**Date:** 2026-08-25
**Status:** approved, pending implementation plan

## Context

The site (`AudreySite.tsx` and its tabs) is currently a fully client-side mock:
guestbook messages, the playlist, and dropped photos are held in React state
and persisted to `localStorage`, which means nothing is shared between
visitors — every guest sees their own private copy of the guestbook. "Her
shelf" (books) and "her sounds" (top artists) are flavor content curated by
the site's builders, not visitor input.

This design replaces the `localStorage` persistence with real shared
storage, so that a guestbook message, playlist addition, or uploaded photo
from one visitor is visible to every other visitor. It also adds a minimal
admin tool to delete abusive content, since the site will be a public,
no-login link before Audrey's birthday (Sep 20, 2026).

## Decisions locked in during brainstorming

- **Album** becomes an open-ended gallery (every upload adds a new shared
  photo) rather than the current 7 fixed per-device slots.
- **Shelf** (books) and **sounds** (top artists) stay hardcoded static
  content — not moved into the database.
- **Moderation**: a passcode-gated `/admin` view with delete buttons.
  No rate limiting, no per-visitor accounts.
- **Guestbook photos**: the existing inert "+ ADD PHOTOS (3 MAX)" button
  gets wired up as part of this work, reusing the same upload pipeline as
  the album.
- **Seed data**: the current mock arrays (`SEED_MESSAGES`, `SEED_PLAYLIST`,
  `ALBUM` captions) are not migrated into the database. Real visitors start
  from an empty guestbook/playlist/album.
- **Hosting**: Vercel. Blob and Neon Postgres are provisioned through the
  Vercel Marketplace so environment variables sync automatically.

## Architecture

- **Reads**: Server Components query Neon Postgres directly at request
  time (`app/page.tsx` becomes `async`). No `/api` layer for reads.
- **Writes**: Next.js Server Actions (`"use server"`), called directly from
  the existing client form handlers in `AudreySite.tsx` and its tabs. Each
  mutation ends with `revalidatePath("/")` so every visitor's next
  request/refresh sees it.
- **Photos**: the browser resizes the image client-side (reusing the
  existing canvas downscale-to-webp logic already in `PhotoSlot.tsx`), then
  uploads the resized bytes directly to Vercel Blob via
  `@vercel/blob/client`'s `upload()`, authorized by a token-issuing Route
  Handler. Only the returned Blob URL is written to Postgres — image bytes
  never pass through a Vercel Function.
- **Admin**: a single shared passcode (env var `ADMIN_PASSCODE`) gates
  `/admin`. A correct passcode sets an httpOnly cookie via a Server Action;
  every delete Server Action re-checks that cookie server-side before
  acting — the client-side gate is not trusted on its own.

### Why this shape (vs. alternatives considered)

- **Server Components + Server Actions**, not a `/api/*` REST layer called
  via `fetch` — this app has no non-browser client, so the extra
  indirection of a REST layer buys nothing.
- **Drizzle ORM** (`drizzle-orm/neon-http`) over raw tagged-template SQL —
  schema-as-code and `drizzle-kit push` migrations are worth the small
  setup cost for a schema that will keep changing as the project
  progresses; typed queries also remove a class of typo bugs in a codebase
  with no test suite.
- **Direct-to-Blob client upload**, not a server-proxied upload — keeps
  image bytes off Vercel Functions entirely, avoids function payload size
  limits, and is the pattern Vercel's own docs recommend for user-uploaded
  media.

## Data model

Four tables, all in the default Neon Postgres database provisioned via the
Vercel Marketplace integration.

```sql
create table guestbook_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  relation    text,                    -- "roommate", "book club", etc. — optional
  body        text not null,
  likes       integer not null default 0,
  created_at  timestamptz not null default now()
);

create table guestbook_photos (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references guestbook_messages(id) on delete cascade,
  blob_url    text not null,
  sort_order  smallint not null default 0
);

create table playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  artist      text,
  added_by    text,                    -- "anonymous" if left blank, matching current UX
  created_at  timestamptz not null default now()
);

create table album_photos (
  id          uuid primary key default gen_random_uuid(),
  blob_url    text not null,
  caption     text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
```

Notes:

- **Colors/gradients are never stored.** `SONG_PALETTES` and the album
  tile color cycling stay as-is, derived client-side from a row's position
  in the list — this is styling, not data.
- **Likes**: `guestbook_messages.likes` is a shared counter, incremented by
  a `toggleLike` Server Action. "Have I already liked this" stays a
  client-only `localStorage` flag (as it is today) purely to stop one
  browser from double-clicking — it is a UX nicety, not an enforced
  constraint, and multiple devices can each contribute one like. This
  matches the low-stakes nature of the feature.
- Cap of 3 photos per guestbook message is enforced in the `postMessage` /
  `addGuestbookPhoto` Server Action, not in the schema.

## Component changes

| File | Change |
|---|---|
| `lib/db/schema.ts` | New. Drizzle schema for the 4 tables above. |
| `lib/db/index.ts` | New. Lazy `getDb()` — must not call `neon()` at module top level (breaks `next build` before env vars exist). |
| `lib/db/queries.ts` | New. Read helpers used by Server Components (`getMessages`, `getPlaylist`, `getAlbumPhotos`). |
| `app/actions.ts` | New. Server Actions: `postMessage` (accepts optional attached-photo URLs), `toggleLike`, `addSong`, `addAlbumPhoto`, `adminLogin`, `deleteMessage`, `deleteSong`, `deletePhoto`. |
| `app/api/blob/upload/route.ts` | New. Blob client-upload token handler (`handleUpload`). |
| `app/page.tsx` | Becomes `async`; fetches messages/playlist/album photos server-side and passes them into `AudreySite` as props. |
| `components/AudreySite.tsx` | Drops the `localStorage` load/save `useEffect`s entirely. Keeps client-side UI state (active tab, in-progress form fields). Mutations call Server Actions instead of local-only `setState`, with an optimistic local update for responsiveness. |
| `components/PhotoSlot.tsx` | Replaced by an uploader component (`components/PhotoUploader.tsx`) that resizes, uploads to Blob, then calls the relevant Server Action. The "fixed slot keyed by localStorage id" concept goes away — album photos are now a growable list, not fixed slots. |
| `components/tabs/PhotosTab.tsx` | Renders the shared album gallery (list from props) plus one upload tile at the end. |
| `components/tabs/GuestbookTab.tsx` | "+ ADD PHOTOS (3 MAX)" becomes a working `PhotoUploader` (multi, capped at 3) attached to the in-progress message. |
| `components/tabs/HomeTab.tsx` | Home preview tiles read from the same album photo list (first 4), instead of the old fixed `album-0..3` slot ids. |
| `app/admin/page.tsx` | New. Passcode form; once authenticated, lists messages/songs/photos with delete buttons. |
| `lib/audrey-data.ts` | `SEED_MESSAGES`, `SEED_PLAYLIST`, `ALBUM`, `GuestbookMessage`/`Track`/`AlbumPhoto` types are removed or trimmed to just the types/static content that remain (`SHELF`, `ARTISTS`, `SONG_PALETTES`, site constants). |

## Data flow examples

**Posting a guestbook message (with optional attached photos)**
1. While composing, the visitor can attach up to 3 photos via the same
   uploader used by the album (see below). Each attach uploads directly to
   Blob as soon as it's picked and the client holds the returned URLs in
   local form state — nothing is written to Postgres yet, since there is
   no message row for `guestbook_photos.message_id` to reference.
2. Clicking "Post it" calls the `postMessage` Server Action with
   `{ name, relation, body, photoUrls: string[] }` (0–3 URLs).
3. Server Action trims/validates (name + body required, length caps,
   `photoUrls.length <= 3`), inserts the `guestbook_messages` row, then
   inserts one `guestbook_photos` row per URL referencing the new message
   id — both in a single Drizzle transaction, so a message never ends up
   with only some of its photos attached. `revalidatePath("/")`.
4. Returns `{ ok: true, message }` or `{ ok: false, error }`; client
   prepends the new message locally for instant feedback (matching current
   UX) and shows the existing `notice` text either way. On failure, the
   already-uploaded photo URLs stay attached in the form so the visitor
   doesn't have to re-upload before retrying "Post it."

**Uploading an album photo**
1. Visitor picks/drops a file → existing canvas logic downscales it
   client-side (long side capped at 1400px, webp @ 0.85) to a `Blob`.
2. `upload(filename, resizedBlob, { access: 'public', handleUploadUrl:
   '/api/blob/upload' })` from `@vercel/blob/client` uploads directly to
   Blob storage; the token route authorizes the upload server-side without
   the bytes passing through it.
3. On success, client calls `addAlbumPhoto({ blobUrl, caption })` to
   record the row in Postgres directly (no message to wait on), then
   `revalidatePath("/")`.
4. Gallery shows the photo immediately (optimistic); it's now visible to
   every future visitor's server-rendered load.

**Admin delete**
1. `/admin` shows a passcode form until the httpOnly cookie is present.
2. `adminLogin(passcode)` Server Action compares against
   `process.env.ADMIN_PASSCODE`; on match, sets the cookie and returns
   `{ ok: true }`; on mismatch, `{ ok: false, error: "incorrect passcode" }`.
3. Delete buttons call `deleteMessage` / `deleteSong` / `deletePhoto`,
   each of which re-checks the cookie server-side before deleting the row
   (and, for photos, also calling Blob's `del()` on the underlying object)
   — the admin page's own gating is not trusted as the only check.

## Error handling

- Server Actions return `{ ok: false, error: string }` on validation or DB
  failure instead of throwing, surfaced through the existing `notice` UI
  pattern already present in the guestbook form.
- Blob upload failures (network, rejected file type) reuse `PhotoSlot`'s
  existing inline `error` state pattern in the new uploader component.
- If a Server Component read fails (e.g. a Neon cold-start hiccup), it
  falls back to an empty list plus a small inline notice rather than
  crashing the page; `app/error.tsx` remains as a backstop.
- Wrong admin passcode: generic "incorrect passcode," no cookie set, no
  hint about which part was wrong.

## Environment / provisioning

New env vars (all synced locally via `vercel env pull .env.local`):

- `DATABASE_URL` — from the Neon Marketplace integration
- `BLOB_READ_WRITE_TOKEN` — from the Vercel Blob store
- `ADMIN_PASSCODE` — set manually, not provisioned by an integration

Provisioning steps (covered in the implementation plan, not repeated here):
link the repo to a Vercel project, add the Neon integration, create a Blob
store, set `ADMIN_PASSCODE`, pull env vars, run `drizzle-kit push` to
create the tables.

## Testing

No test runner is configured in this repo, and this is a one-off personal
site. Verification is manual: run the dev server and walk each flow (post
a message, add a song, upload an album photo, attach a guestbook photo,
like, admin login, admin delete of each content type) end to end against
the real Neon/Blob resources. Lightweight unit tests around Server Action
validation logic are a possible follow-up, not part of this pass.

## Out of scope

- Rate limiting / per-IP throttling (explicitly declined during
  brainstorming — admin delete is the only moderation tool).
- Moving `SHELF` / `ARTISTS` static content into the database.
- Real user accounts/auth (single shared admin passcode only).
- Migrating the current mock seed content into the new tables.
