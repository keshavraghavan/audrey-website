# Sounds tab — Spotify search + real shared playlist

**Date:** 2026-09-13
**Status:** approved, pending implementation plan

## Context

The Sounds tab (`components/tabs/SoundsTab.tsx`) currently has visitors
hand-type a song title and artist into two plain text fields; the result is
held in React state and persisted to `localStorage`, so — like the rest of
the site before this change — nobody's additions are visible to anyone
else, including Audrey. The "HER SOUNDS" top-artists panel that used to sit
alongside it was removed in this same session (dead hardcoded flavor
content, no longer wanted).

This design replaces manual entry with a live Spotify search (type-ahead
dropdown, pick a real track), stores everyone's picks in a real shared
database so the mix is the same for every visitor, and adds a one-time,
passphrase-gated flow for Audrey to connect her own Spotify account — at
which point a real playlist is created on her account and kept in sync
automatically as friends keep adding songs.

**Relationship to the 2026-08-25 backend-persistence spec:** that spec
(approved, never implemented) also covers a `playlist_tracks` table, but
its schema has no Spotify metadata and its decisions record explicitly
says "Sounds (top artists) stays hardcoded — not moved into the database."
Both are now out of date: the top-artists panel is gone, and the playlist
needs real Spotify fields. This design **supersedes that spec's playlist
section** (superseded table replaced by `tracks` below) while leaving its
guestbook, album/Blob, and admin sections untouched and still pending —
those remain a separate future implementation pass, not part of this one.
The shared architectural choices that spec already made (Server Components
for reads, Server Actions for writes + `revalidatePath`, Drizzle over raw
SQL, a lazy `getDb()` that never calls `neon()` at module load time) carry
over unchanged and are reused here rather than re-decided.

## Decisions locked in during brainstorming

- **Shared storage**: the playlist moves from per-browser `localStorage` to
  Neon Postgres, so one visitor's addition is visible to every other
  visitor and to Audrey.
- **Entry is Spotify-search-only**: the old manual "song" / "artist" text
  inputs are removed. A track can only be added by picking a real Spotify
  search result.
- **Playlist creation is automated, not manual hand-off**: once Audrey
  completes a one-time Spotify login, the app creates a real playlist on
  her account via the Spotify Web API and keeps appending new tracks to it
  as they're added — she never has to build it herself.
- **Connect gating**: the one-time connect step lives at an unlisted route
  (`/connect-spotify`, not in nav) behind a shared passphrase
  (`CONNECT_PASSPHRASE` env var) — nothing stronger, matching this site's
  existing low-stakes admin/moderation posture.
- **New playlist starts private.** Audrey can make it public herself later.
- **No PKCE.** Everything server-side here is a confidential client (the
  `client_secret` never reaches a browser), so the plain OAuth
  Authorization Code flow is used — PKCE exists for clients that *can't*
  hold a secret, which doesn't apply.
- **Seed data**: `SEED_PLAYLIST`'s fictional entries are dropped. The mix
  starts empty; once this is wired to a real Spotify playlist, fabricated
  "songs" would otherwise get pushed to Audrey's actual account.
- **Out of scope for this pass**: guestbook and album/photo persistence,
  Blob uploads, and the admin moderation panel — all still owned by the
  2026-08-25 spec, unimplemented, and left for a later pass.

## Architecture

- **Reads**: `app/page.tsx` becomes `async` and queries Neon Postgres
  directly at request time for the current track list, passed into
  `AudreySite` as a prop — no `/api` layer for reads, matching the
  2026-08-25 spec's rationale (this app has no non-browser client).
- **Search**: `app/api/spotify/search/route.ts`, a Route Handler — this
  *is* external API consumption (proxying to Spotify), which is exactly
  what Route Handlers are for, unlike the UI-triggered mutations below.
- **Writes**: Server Actions (`"use server"`), called from
  `SoundsTab.tsx`'s existing form-handler pattern. `addTrackToMix` ends
  with `revalidatePath("/")` so every visitor's next request sees it.
- **Spotify connect**: `connectSpotify` Server Action (passphrase check +
  redirect to Spotify's authorize screen) plus
  `app/api/spotify/callback/route.ts`, a Route Handler, since Spotify's
  redirect back is effectively a webhook-style external callback, not a
  UI-triggered mutation.
- **Runtime**: default Node.js runtime everywhere here (DB access, Neon
  serverless driver, no edge-specific need).

### Why this shape (vs. alternatives considered)

- **Route Handler for search, Server Action for the add mutation** — this
  follows the project's own stated rule of thumb: external API consumption
  and webhook-style callbacks are Route Handlers; UI-triggered mutations
  are Server Actions. Search-as-you-type also benefits from a plain
  `fetch` + `AbortController` on the client to cancel stale keystrokes,
  which is the more natural shape against a Route Handler than a Server
  Action call.
- **Authorization Code flow without PKCE** — simpler than PKCE (no code
  verifier/challenge to generate and stash), and just as secure here since
  the `client_secret` never leaves server env vars. `state` alone (in a
  short-lived httpOnly cookie) covers CSRF protection for the redirect.
- **App-only search token kept in memory, not the database** — it's not
  user-specific, expires in ~1 hour, and this is a single small
  deployment; persisting it would add a table for no real benefit over a
  module-level variable that's refetched near expiry.
- **Live sync on every add, not a batch/cron job** — the friend-group
  scale here is small enough that syncing one track per add is cheap, and
  it means Audrey's real playlist is never stale by more than one request.

## Data model

Extends `lib/db/schema.ts` (new file, shared with any future work from the
2026-08-25 spec) with two tables:

```sql
create table tracks (
  id             uuid primary key default gen_random_uuid(),
  spotify_id     text not null unique,
  spotify_uri    text not null,
  title          text not null,
  artist         text not null,
  album_art_url  text,
  added_by       text not null,
  synced_at      timestamptz,           -- set once pushed to the real playlist
  created_at     timestamptz not null default now()
);

create table spotify_connection (
  id            uuid primary key default gen_random_uuid(),
  refresh_token text not null,
  playlist_id   text,                  -- null until the playlist is created
  connected_at  timestamptz not null default now()
);
```

Notes:

- `spotify_connection` will only ever hold one row in practice (single
  target account); it's a table rather than a hardcoded singleton so
  reconnecting is just an upsert, not a schema change.
- `spotify_id unique` makes re-adding the same track a friendly no-op
  ("already on the mix!") rather than a duplicate row or a hard error.
- `synced_at` exists purely for observability (so a failed live-sync is
  visible in the data, not silently invisible) — nothing reads it to
  drive behavior in this pass; a future retry job could use it.
- Colors/gradients are not stored, same rule as the 2026-08-25 spec —
  `album_art_url` (a real Spotify image) replaces the old
  client-generated gradient tile entirely for track rows.

## Component changes

| File | Change |
|---|---|
| `lib/db/schema.ts` | New. Drizzle schema — `tracks`, `spotify_connection` (additive; future guestbook/album work from the 2026-08-25 spec would extend this same file). |
| `lib/db/index.ts` | New. Lazy `getDb()` — must not call `neon()` at module top level (breaks `next build` before env vars exist). |
| `lib/spotify.ts` | New. Server-only helpers: app token fetch/cache (Client Credentials), user token refresh, search call, playlist create/add-items calls. Never imported from a Client Component. |
| `app/api/spotify/search/route.ts` | New. `GET`, proxies to Spotify search using the cached app token, maps results to `{ id, uri, title, artist, albumArtUrl }[]`. Empty/short query short-circuits to `[]` without calling Spotify. |
| `app/api/spotify/callback/route.ts` | New. Exchanges the OAuth code for tokens, validates `state` against the cookie set by `connectSpotify`, creates the playlist (only if `spotify_connection.playlist_id` is still null), bulk-syncs existing `tracks` rows, upserts `spotify_connection`. |
| `app/actions.ts` | New. Server Actions: `addTrackToMix`, `connectSpotify`. |
| `app/connect-spotify/page.tsx` | New. Unlisted, not in nav. Passphrase form; on success, `connectSpotify` redirects to Spotify. Shows a plain "connected — created '<name>'s Birthday Mix' with N songs" confirmation after the callback redirects back here with a status flag. |
| `app/page.tsx` | Becomes `async`; fetches the current `tracks` list server-side and passes it into `AudreySite` as a prop, replacing the `SEED_PLAYLIST` import. |
| `components/AudreySite.tsx` | Drops the playlist half of the `localStorage` load/save effect (guestbook/messages persistence is untouched — out of scope). Keeps `songBy` and the new `selectedTrack` as client UI state; `addSong`/`songTitle`/`songArtist` callback wiring is replaced by a call to the `addTrackToMix` Server Action with an optimistic local prepend, matching the existing guestbook `notice` pattern. |
| `components/tabs/SoundsTab.tsx` | Manual "song"/"artist" inputs replaced by a debounced search input + results dropdown (new small internal component, e.g. `SongSearch`); track rows render `album_art_url` instead of a gradient swatch. |
| `lib/audrey-data.ts` | `SEED_PLAYLIST` and the `Track` type's `colors` field are removed; `Track` gains the Spotify fields listed above. `TABS`' "Her sounds" label is untouched (not part of this request). |

## Data flow examples

**Searching**
1. Visitor types in the search box; input is debounced ~300ms.
2. Client calls `GET /api/spotify/search?q=...` with an `AbortController`
   that cancels the previous in-flight request on every keystroke.
3. Route Handler ensures a valid app access token (cached module-level,
   refetched if expired or absent), calls Spotify's search endpoint
   (`type=track&limit=8`), maps the response down to the small shape the
   client needs, returns it.
4. Dropdown renders up to 8 results; clicking one stores it as the pending
   selection (replacing the dropdown with a small chip) and clears the
   query text.

**Adding a track**
1. Visitor has a pending selection and has typed their name, clicks "Add
   to the mix."
2. Client calls `addTrackToMix({ spotifyId, spotifyUri, title, artist,
   albumArtUrl, addedBy })`.
3. Server Action validates `addedBy` is non-empty and a selection is
   present, inserts into `tracks` (`on conflict (spotify_id) do nothing`
   to detect a duplicate).
4. If `spotify_connection` has a `playlist_id`, immediately refreshes an
   access token from the stored `refresh_token` and calls Spotify's "Add
   Items to Playlist" with the new track's URI, then stamps `synced_at`.
   A failure here (revoked token, Spotify outage) is caught and logged —
   it does **not** fail the add; the track is already safely in `tracks`.
5. `revalidatePath("/")`. Returns `{ ok: true }` / `{ ok: true, duplicate:
   true }` / `{ ok: false, error }`; client shows the result via the
   existing `notice` text field and, on success, prepends the track to its
   local list for instant feedback.

**Connecting Spotify (one-time, or reconnecting)**
1. Audrey visits `/connect-spotify`, enters the passphrase.
2. `connectSpotify` Server Action compares it to `process.env
   .CONNECT_PASSPHRASE` (constant-time compare); on mismatch, returns an
   inline error and nothing else happens.
3. On match: generates a random `state`, sets it in a short-lived httpOnly
   cookie, and `redirect()`s to Spotify's `/authorize` with
   `client_id`, `redirect_uri` (the callback route), `scope=
   playlist-modify-public playlist-modify-private`, and `state`.
4. Spotify redirects back to `/api/spotify/callback?code=...&state=...`.
   The handler checks `state` against the cookie, exchanges `code` for an
   access + refresh token (`client_secret` included — confidential
   client), calls `/v1/me` for her user id.
5. If `spotify_connection.playlist_id` is still null, creates a new
   *private* playlist (`POST /v1/me/playlists`) named "<NAME>'s Birthday
   Mix"; otherwise reuses the existing `playlist_id` (a reconnect just
   refreshes tokens, never creates a second playlist).
6. Upserts `spotify_connection` with the new `refresh_token` and
   `playlist_id`.
7. Bulk-syncs every `tracks` row that doesn't yet have `synced_at` set,
   in `created_at` order, chunked to Spotify's 100-URIs-per-call limit,
   stamping `synced_at` on each as it's pushed.
8. Redirects to `/connect-spotify?status=connected&count=N`, which renders
   a plain confirmation instead of the passphrase form.

## Error handling

- Search failures (Spotify outage, missing env vars): the Route Handler
  returns a clear error status; the dropdown shows an inline "couldn't
  search right now" message rather than crashing the tab. There is no
  manual-entry fallback — search-only is the explicit decision above, so a
  Spotify outage means the mix just can't grow until it recovers.
- Duplicate track: surfaced through the existing `notice` pattern
  ("already on the mix!"), not treated as an error.
- Live-sync-to-real-playlist failures during `addTrackToMix` never block
  the local add (see step 4 above) — logged only.
- Wrong passphrase at `/connect-spotify`: generic inline error, no cookie
  set, no redirect attempted.
- If a Neon read fails on `app/page.tsx`'s server fetch, it falls back to
  an empty track list plus a small inline notice rather than crashing the
  page, matching the 2026-08-25 spec's same rule for its own reads.

## Environment / provisioning

- `DATABASE_URL` — Neon Postgres, provisioned via the Vercel Marketplace
  integration once this project is linked to Vercel (or a direct
  neon.tech connection string for local-only work in the meantime).
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — from a freshly created
  Spotify Developer app (the user is creating this, not reusing an
  existing app's keys).
- Redirect URI to register in the Spotify app dashboard:
  `http://127.0.0.1:3000/api/spotify/callback` for local dev (Spotify
  requires the loopback IP form, not `localhost`) plus the production
  domain's equivalent once deployed.
- `CONNECT_PASSPHRASE` — any passphrase, set manually (not provisioned by
  an integration), gating `/connect-spotify`.
- All added to `.env.local` (gitignored) and mirrored to Vercel's project
  env vars for production.

## Testing

No test runner is configured in this repo (matching the 2026-08-25 spec's
own note) and this is a one-off personal site. Unit-testable pure logic —
the Spotify search-response mapper, the app-token expiry check, the
duplicate-detection branch — can get lightweight tests as a follow-up but
isn't blocking. Primary verification is manual, end to end against real
Spotify and a real Neon database: search returns results, adding a track
persists (visible after a hard refresh, proving it's not just local
state), and connecting via `/connect-spotify` with a disposable/test
Spotify account creates a real private playlist and pushes existing
tracks into it.

## Out of scope

- Guestbook message persistence, album/photo uploads via Blob, and the
  admin moderation panel — all still owned by the 2026-08-25 spec,
  unimplemented, left for a separate future pass.
- Renaming the "Her sounds" nav tab label.
- Keyboard navigation (arrow keys/Enter) in the search dropdown — click
  selection only for this pass.
- Retry/backoff for a failed live-sync beyond the `synced_at` marker
  already recorded.
- Rate limiting / per-IP throttling on search or add (matches the
  2026-08-25 spec's same explicit decision).
