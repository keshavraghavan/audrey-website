# Guestbook — shared messages + Blob photo uploads

**Date:** 2026-09-17
**Status:** approved, pending implementation plan

## Context

The Guestbook tab (`components/tabs/GuestbookTab.tsx`) is currently a fully
client-side mock: messages live in React state seeded from
`SEED_MESSAGES` and persisted to `localStorage`, so nobody's post is
visible to anyone else — every visitor sees their own private copy. The
"+ ADD PHOTOS (3 MAX)" button in the post form is an inert visual stub
with no upload logic; the photos rendered next to some seed messages
(e.g. Dad's) are hardcoded static placeholders (`PhotoSlot id="dad-1"`),
not per-message uploads.

This design makes the guestbook real: shared Postgres storage so a
message posted by one visitor is visible to every other visitor, and a
working photo attachment flow (up to 3 photos per message) via Vercel
Blob.

**Relationship to the 2026-08-25 backend-persistence spec:** that spec
(approved, never implemented) already covers a guestbook design in
detail — `guestbook_messages` + `guestbook_photos` tables, a Blob
client-upload pipeline, an admin moderation panel, and converting the
photo album to a shared gallery, all as one bundled pass. The 2026-09-13
Spotify spec later split the playlist section out of that bundle and
explicitly left "guestbook, album/Blob, and admin" for a separate future
pass. This spec **is** that pass, but scoped narrower on purpose (see
Decisions below): guestbook messages + photos only. The admin panel and
the album/photos-tab gallery conversion remain unimplemented and are
explicitly deferred again — a future pass, not this one. The shared
architectural choices the Aug 25 spec already made (Server Components
for reads, Server Actions for writes + `revalidatePath`, Drizzle over
raw SQL, a lazy `getDb()` that never calls `neon()` at module load time,
direct-to-Blob client upload) carry over unchanged and are reused here,
matching how the Spotify spec reused them.

**This spec overrides two of the Aug 25 spec's guestbook decisions:**

- **Seed data IS migrated.** The Aug 25 spec said the guestbook starts
  empty; this time the 4 existing `SEED_MESSAGES` (Priya, Dad, Marcus,
  Jules) are inserted as real rows so the guestbook doesn't look empty
  on first launch, matching what visitors see today.
- **Photos are a `text[]` column on `guestbook_messages`, not a separate
  `guestbook_photos` join table.** See "Why this shape" below.

## Decisions locked in during brainstorming

- **No passphrase gate.** Posting stays open to anyone with the site
  link, matching current behavior. (Considered reusing
  `CONNECT_PASSPHRASE`; declined — matches this site's existing
  low-stakes posture, same reasoning as the Spotify connect gate being
  the *only* gated thing on the site.)
- **Scope is guestbook messages + photos only.** The admin
  passcode-gated delete panel and the album/photos-tab shared-gallery
  conversion (both in the Aug 25 spec) are explicitly deferred to a
  later pass, not part of this one.
- **Likes stay client-tracked for "have I liked this," same as today** —
  no accounts exist to enforce real per-visitor dedup. The count itself
  moves from a static seed number to a real shared Postgres column.
- **Partial photo-upload failure doesn't block the post.** If 1 of 3
  photos fails to upload, the message posts with whichever succeeded.
- **`meta` and `tint`/`swatch` are derived, not stored.** Real messages
  have no form field for relationship/role, so there's no `meta` string
  to persist — "time ago" is computed from `created_at` at render time.
  `tint`/`swatch` are derived deterministically from the message `id`
  (e.g. hash into one of the 3 tints) rather than hand-picked, since
  there's no UI for choosing one.

## Architecture

- **Reads**: `app/page.tsx` queries Neon Postgres directly at request
  time for the current message list (newest first), passed into
  `AudreySite` as a prop — no `/api` layer for reads, matching both
  prior specs.
- **Writes**: Server Actions (`"use server"`) in `app/actions.ts`,
  called from `GuestbookTab.tsx`'s existing form-handler pattern.
  `postGuestbookMessage` and `toggleGuestbookLike` both end with
  `revalidatePath("/")`.
- **Photos**: client-side direct upload to Vercel Blob via
  `@vercel/blob/client`'s `upload()`, authorized by a token-issuing
  Route Handler (`app/api/blob/upload/route.ts`, using `handleUpload`).
  Only the returned Blob URLs are written to Postgres — image bytes
  never pass through a Vercel Function. This matters because these are
  phone-camera photos (multiple MB each), well past the request body
  size a Server Action can safely accept.

### Why this shape (vs. alternatives considered)

- **`text[]` column instead of a `guestbook_photos` join table** (the
  Aug 25 spec's original approach): there's no per-photo metadata
  (no captions, no independent reordering UI — order is just upload
  order) and the 3-photo cap is already enforced in the Server Action,
  not the schema. A join table plus a transactional multi-row insert is
  real complexity bought for zero present benefit. If per-photo
  metadata is ever needed, migrating a `text[]` column to a child table
  is a small, isolated future change — not a reason to build it now.
  This is the one place this spec knowingly diverges from the Aug 25
  design.
- **Direct-to-Blob client upload, not a server-proxied upload** — same
  reasoning as the Aug 25 spec: keeps image bytes off Vercel Functions
  entirely, avoids function payload size limits, and is the pattern
  Vercel's own docs recommend for user-uploaded media.
- **No `onUploadCompleted` webhook dependency** — that callback doesn't
  fire reliably against `localhost` in dev. The DB row is written
  explicitly by the client calling `postGuestbookMessage` after it
  receives the Blob URLs back from `upload()`, so nothing depends on
  the webhook firing.

## Data model

Extends `lib/db/schema.ts` (already holds `tracks` and
`spotify_connection` from the Spotify pass) with one table:

```sql
create table guestbook_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  body        text not null,
  photo_urls  text[] not null default '{}',  -- 0-3 Blob URLs
  likes       integer not null default 0,
  created_at  timestamptz not null default now()
);
```

Notes:

- Cap of 3 photos is enforced in the `postGuestbookMessage` Server
  Action, not the schema.
- `tint`/`swatch`/`meta` are never stored — derived at render time from
  `id` and `created_at` respectively (see Decisions above).
- `likes` is a shared counter, incremented/decremented by
  `toggleGuestbookLike`. "Have I already liked this" stays a
  client-only `localStorage` flag, as today — a UX nicety, not an
  enforced constraint.

## Component changes

| File | Change |
|---|---|
| `lib/db/schema.ts` | Add `guestbookMessages` table (existing file, additive). |
| `app/api/blob/upload/route.ts` | New. Blob client-upload token handler (`handleUpload`), restricts to image content types. |
| `app/actions.ts` | Add `postGuestbookMessage({ name, body, photoUrls })` and `toggleGuestbookLike(id, liked)` (existing file, additive — joins `connectSpotify`/`addTrackToMix`). |
| `app/page.tsx` | Fetches `guestbook_messages` server-side (newest first) and passes them into `AudreySite` as a prop, replacing the `SEED_MESSAGES` import. |
| `components/AudreySite.tsx` | Drops the guestbook half of the `localStorage` load/save effect. Keeps in-progress form fields (`formName`, `formBody`, pending photo URLs) as client UI state. `postMessage`/`toggleLike` callbacks call the new Server Actions with an optimistic local update, matching the existing `addTrackToMix` pattern. |
| `components/tabs/GuestbookTab.tsx` | "+ ADD PHOTOS (3 MAX)" becomes a working uploader (multi-select, capped at 3, client-direct-to-Blob). Rendered photos come from `m.photoUrls` instead of the hardcoded `PhotoSlot id="dad-1"/"dad-2"`. |
| `lib/audrey-data.ts` | `SEED_MESSAGES` and the `GuestbookMessage` type's `meta`/`tint`/`swatch`/`photos` fields are removed or trimmed; `GuestbookMessage` becomes the DB row shape (`id, name, body, photoUrls, likes, createdAt`). |
| `scripts/seed-guestbook.ts` | New, one-off. Inserts the 4 existing `SEED_MESSAGES` as real rows. Run once against production before/at launch, not part of the app's runtime code. |

## Data flow examples

**Posting a guestbook message (with optional attached photos)**
1. While composing, the visitor can attach up to 3 photos. Each attach
   uploads directly to Blob as soon as it's picked (`upload(filename,
   file, { access: 'public', handleUploadUrl: '/api/blob/upload' })`);
   the client holds the returned URLs in local form state.
2. If an individual upload fails, it's dropped silently (per the
   partial-failure decision above) — the visitor isn't blocked, and
   already-succeeded URLs stay attached.
3. Clicking "Post it" calls `postGuestbookMessage({ name, body,
   photoUrls })` (0-3 URLs).
4. Server Action trims/validates (name + body required,
   `photoUrls.length <= 3`), inserts the row, `revalidatePath("/")`.
5. Returns `{ ok: true, message }` or `{ ok: false, error }`; client
   prepends the new message locally for instant feedback and shows the
   existing `notice` text either way. On failure, already-uploaded
   photo URLs stay attached so the visitor doesn't have to re-upload
   before retrying.

**Liking a message**
1. Visitor clicks the heart; client checks its local `liked` flag for
   that message id to decide direction (like vs. unlike).
2. Calls `toggleGuestbookLike(id, nextLiked)`, which increments or
   decrements `likes` server-side, `revalidatePath("/")`.
3. Client optimistically flips its local `liked` flag and the displayed
   count immediately, matching current UX.

## Error handling

- Server Actions return `{ ok: false, error: string }` on validation or
  DB failure instead of throwing, surfaced through the existing
  `notice` UI pattern.
- Blob upload failures (network, rejected file type) fail that one
  photo only, per the partial-failure decision — no error surfaced
  unless every photo fails and the visitor still has text to post
  (which still succeeds; photos are optional).
- If the `app/page.tsx` server read fails (e.g. a Neon cold-start
  hiccup), it falls back to an empty list plus a small inline notice
  rather than crashing the page, matching both prior specs' same rule.

## Environment / provisioning

- `DATABASE_URL` — already provisioned (Neon, shared with the Spotify
  feature). No action needed.
- `BLOB_READ_WRITE_TOKEN` — **not yet provisioned.** A Blob store needs
  to be created for this Vercel project (dashboard or `vercel` CLI),
  then synced locally via `vercel env pull .env.local`. Covered in the
  implementation plan, not repeated here.

## Testing

No test runner is configured in this repo (matching both prior specs).
Verification is manual: run the dev server and walk the flow end to
end against the real Neon/Blob resources — post a text-only message,
post one with photos, reload (a different browser/tab) to confirm it's
now actually shared rather than local-only, toggle a like, confirm the
seed script's 4 messages appear correctly tinted/timestamped.

## Out of scope

- Admin moderation panel (deferred again — still owned by the Aug 25
  spec, unimplemented).
- Album/photos-tab conversion to a shared gallery (deferred again —
  still owned by the Aug 25 spec, unimplemented).
- Rate limiting / per-IP throttling (matches both prior specs' same
  explicit decision).
- Real per-visitor like dedup / accounts.
- Keyboard/drag-drop niceties for photo attachment beyond a basic file
  picker.
