# Y2K sticker header — design spec

## 1. Goal

Turn the hero panel in `components/AudreySite.tsx` (the pink gradient block
containing the "HAPPY BIRTHDAY AUDREY" title, the CTA buttons, and the
countdown line) into a background made of individually draggable Y2K
stickers — every sticker its own vector object with its own identity, idle
motion, and drag behavior. The feel: someone covered a laptop lid in
stickers and you can peel and reposition each one.

This spec adapts an original handoff brief (die-cut sticker sheet,
early-2000s mall-goth register: near-black ground, hot pink + acid green,
chrome) to fit the site's **existing** palette and background system instead
of introducing a new one. Nothing here contradicts the original brief's
*technical* architecture (registry, drag hook, layering, persistence,
accessibility, performance) — that part is carried over unchanged in
section 7. What changes is the art direction: color system, backing
surface, and five of the twenty-two sticker subjects.

## 2. Integration point

- The sticker field replaces the current panel background — the
  `linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 48%,
  var(--accent-dark) 52%, var(--accent) 100%)` treatment in
  `AudreySite.tsx` — with the checker/dot/bloom surface described in
  section 4. The title, CTA buttons, and countdown line stay in place, in a
  content layer above the sticker field (see section 7.6).
- The panel's soft top sheen (`linear-gradient(rgba(255,255,255,0.42),
  rgba(255,255,255,0))` over the top half) stays, at reduced opacity —
  enough to keep a glossy, laminated-surface quality without washing out
  the checker pattern under it.
- The existing decorative spinning disc (the conic-gradient circle, top
  right of the panel, `AudreySite.tsx` ~lines 273–289) is **removed**. The
  CD-R and vinyl-record stickers now own that motif inside the field
  itself; keeping the standalone spinner next to them would be redundant.
- Everything outside the panel (tabs, guestbook, sounds, photos, footer)
  is unchanged.

## 3. Color system

Replaces the original brief's near-black/acid-green/chrome register with
colors already established in `globals.css` and `lib/audrey-data.ts`.

| Role | Original brief | Adapted |
|---|---|---|
| Primary saturated colors | hot pink only | hot pink `--accent` (`#ff2d95`) **and** teal `#009a9a` as co-leads — mirrors the pink = guestbook / teal = sounds split already used elsewhere on the site |
| Secondary accents | — | gold `#ffb300`, lavender `#7a4dff`, and occasionally the warm orange-red `#a8330f` (Adrianne Lenker's swatch in `ARTISTS`) — each used sparingly, on one or two stickers |
| Outline ink ("black") | `#000` | `#2b0a1e` — the deep maroon-black already used for the on-repeat player panel background. Reads as a hard outline at the same weight, but warm instead of true black |
| Chrome | grey→white→grey, hard band | unchanged — a material, not a mood; fits 2000s tech as-is |
| Screen / CRT accent | acid green on black, used broadly | `#00ff9d` — a color the site *already uses* (top-bar corner badge, equalizer bars in `BAR_COLORS`). Kept, but demoted to a specific callback: only appears on small LCD-screen chips (`#2b0a1e` background) on the flip phone, brick phone, and NO SIGNAL sticker — three uses of one existing accent, not a new palette |
| Die-cut border | thick white, 3–4 units | unchanged — a sticker-sheet convention independent of background color; keeps stickers reading as objects sitting on the surface |

## 4. Backing surface

The panel's flat gradient is replaced by a brighter build of the site's own
background recipe (`globals.css`, currently on `body`): the two-tone
checker (`repeating-conic-gradient`, `#e6cfdd` / `#f6ebf1`), the white dot
grain (`radial-gradient(circle at 3px 3px, ...)`), and the soft teal/pink/
gold radial blooms. Same recipe, scaled and positioned to read clearly
behind a dense sticker field rather than behind empty space. The title
keeps a soft radial scrim behind it if legibility needs help, per the
original brief's own fallback — stickers never get dimmed to compensate.

## 5. Sticker manifest

22 stickers total. 8 keep both subject and color, 9 keep subject with a
recolor, 5 swap subject entirely. Each still fits a 100×100 viewBox with
~6-unit inset, natural render size 48–130px, own type treatment where it
carries lettering — per the original brief's per-sticker rules (carried
into section 7.1 unchanged).

**Tech objects**

1. **mp3 player** — click-wheel, white earbud cord trailing off the sticker
   edge. Bubblegum pink body, chrome bezel. *(unchanged)*
2. **flip phone** — open, tiny screen. Shell recolored to **teal**
   (mp3 player already owns pink; alternating keeps the sheet varied),
   silver hinge. Screen is a small `#2b0a1e` chip, `#00ff9d` pixel text:
   `1 NEW MSG`.
3. **digicam** — chrome body, small point-and-shoot, flash-blowout
   starburst. Grip recolored to ink `#2b0a1e` (was black — same value in
   spirit).
4. **hair clips** — pair of butterfly clips. One chrome/iridescent, one
   recolored to **lavender** (was matte black).
5. **studded belt fragment** — running diagonally off both sticker edges.
   Ink-colored leather, chrome pyramid studs.
6. **platform boot** — chunky sole, side profile. Ink body, laces
   recolored to **teal** (was red).
7. **CD-R** — sharpie handwriting on the label, chrome disc, six-hard-stop
   refraction arc — recolored so the arc runs the full site accent family
   in sequence: pink → teal → gold → lavender → orange-red → pink, instead
   of a generic rainbow.
8. **brick phone** — candybar phone, ink/grey body. Screen is another
   `#2b0a1e` chip with `#00ff9d` Snake-game pixels (second CRT-chip
   callback, same recipe as the flip phone).

**Type stickers** (lettering is artwork, own type treatment, not a shared
font — per original brief)

9. **SO WRONG** — bubble letters, hot pink fill, ink (`#2b0a1e`) outline.
10. **2 GOOD 4 U** — chrome bevel, arched baseline. *(unchanged)*
11. **NO SIGNAL** — pixel font, `#00ff9d` on a `#2b0a1e` chip (third CRT
    callback — same recipe as both phone screens).
12. **whatever.** — lowercase, thin gothic serif, recolored to ink
    `#2b0a1e` (was pure black). Left as the one deliberate touch of edge —
    diary irony, not goth.

**Motifs**

13. **book stack** *(was: black rose)* — three fanned, dog-eared
    paperbacks, spines in teal/gold/lavender, a ribbon bookmark trailing
    off the sticker edge — rhymes with the earbud-cord-off-edge move on
    the mp3 player. Direct callback to "you were on page nine of all
    three" from the seed guestbook.
14. **broken heart** — split down the middle, hot pink / cream (was
    pink/black).
15. **unspooled cassette tape** *(was: barbed wire)* — a cassette with the
    tape ribbon spilling out in the same diagonal arc the barbed wire had;
    same compositional role (a linear accent cutting across the sticker),
    new subject. Matte ribbon in ink, plastic shell in teal or lavender.
16. **cat-eye sunglasses with a bow charm** *(was: skull + bow)* — cream
    frames, lightly tinted lenses, a small hot-pink bow charm on the
    hinge. Keeps the skull+bow's "cute but a little smug" attitude without
    the skull.
17. **spinning vinyl record** *(was: eyeliner eye)* — chrome center label,
    a thin rainbow light-streak across the surface (same 5-color family as
    the CD-R arc) — analog counterpart to the CD-R, not a duplicate.
18. **firefly in a jar** *(was: moth)* — small glass jar, warm gold glow,
    faint wings. Wistful/late-night mood, no goth undertone.
19. **lightning bolt** — gold fill (was acid yellow — near-zero change,
    gold was already in-palette), ink outline.
20. **chrome star** — four-point star, hard drop shadow, chrome.
    *(unchanged)*
21. **halftone patch** — pure texture, dot gradient fading hot pink →
    cream (was pink → black).
22. **checkerboard** — warped strip, recolored to literally match the
    panel's own checker recipe (section 4) — a swatch of the background
    peeled up as its own sticker.

## 6. Composition & layout guidance

- **Zones.** Loosely divide the panel into a *clear zone* under the title/
  CTA/countdown block (left side, ~520px wide) and a *dense zone* covering
  the rest — including the area the old spinner occupied. The clear zone
  gets only 2–3 small stickers, edge-anchored, nothing crossing the text
  baseline. The dense zone carries the bulk of the pile.
- **Scale variety.** "Hero" stickers (CD-R, vinyl record, mp3 player, book
  stack) run 110–130px. Mid-size objects (phones, boot, belt, sunglasses,
  firefly jar) run 70–100px. Type stickers and small motifs (lightning
  bolt, chrome star, halftone patch, checkerboard, hair clips) run 48–70px
  and scatter as filler between the larger pieces.
- **Overlap.** 4–6 deliberate overlaps concentrated in the dense zone sell
  the "pile" (e.g. chrome star clipping the corner of the CD-R, halftone
  patch tucked half behind the boot, checkerboard peeking from under the
  belt). The clear zone has no overlap — it stays legible.
- **Edge bleed.** The earbud cord, belt fragment, bookmark ribbon, and
  cassette tape are all designed to visually run off the sticker's own
  edge — lean into that by placing them near the panel's outer edges so
  the "sheet" feels like it extends past the visible surface.
- **Rotation.** Keep the original brief's −18°…18° range for objects and
  motifs; bias type stickers toward a narrower ±6–8° so lettering stays
  readable at a glance.
- Exact per-sticker `home`/`rotation`/`layer`/`drift` values are authored
  by hand as part of implementation (hardcoded literals, per section 7.1)
  — this section sets the strategy, not the coordinates.

## 7. Architecture (carried over from the original handoff brief, unchanged)

### 7.1 Sticker registry — `lib/stickers/registry.ts`

```ts
export type StickerId = string;

export interface StickerDef {
  id: StickerId;
  Art: React.FC<{ className?: string }>;  // renders the <svg>
  size: number;          // px, natural width
  home: { x: number; y: number };  // % of header box, 0–100
  rotation: number;      // deg, -18..18
  layer: number;         // base z-index, 0..n
  drift: { amplitude: number; duration: number; delay: number };
}

export const STICKERS: StickerDef[] = [ /* ... */ ];
```

`home`, `rotation`, `layer`, and `drift` are hardcoded literals, not
generated at runtime — random placement computed during render produces a
hydration mismatch in the App Router and the stickers visibly jump on
load. Author positions by hand (or generate once with a script and commit
the output).

### 7.2 Two transform layers per sticker

Idle drift and drag position both want `transform`. Nest them so they
don't clobber each other:

```
<div data-sticker>            ← JS writes translate3d(dragX, dragY, 0); z-index
  <div data-drift>            ← CSS keyframe animation: float + slow rotate
    <svg />                   ← static rotation baked in as a wrapper transform
  </div>
</div>
```

The outer element is imperative, touched only by pointer handlers. The
inner element is declarative CSS, never touched by JS.

### 7.3 Drag — `hooks/useStickerDrag.ts`

- `pointerdown` → `setPointerCapture`, record pointer/translate offset,
  promote `z-index` to `topZ++`, set `will-change: transform`, pause drift
  (`animation-play-state: paused`)
- `pointermove` → compute next translate into a ref, batch the write in a
  single `requestAnimationFrame`. Never `setState` per move event; never
  read layout inside the move handler
- `pointerup` / `pointercancel` → release capture, clear `will-change`,
  resume drift, persist
- Pointer Events only — no HTML5 drag-and-drop (ghost image, no touch),
  no global `mousemove` listeners; capture on the sticker itself

**Bounds:** clamp translate so at least 60% of each sticker stays inside
the header box.

**Touch scroll conflict:** stickers need `touch-action: none` to drag on
mobile, but that traps page scroll if applied broadly. Resolve with an
intent threshold: on `pointerType === 'touch'`, don't claim the gesture
until the pointer has moved >~8px horizontally and less than that
vertically, or until a 200ms hold. Vertical-first movement stays a page
scroll. Apply `touch-action: none` to the sticker only once drag is
claimed, never to the container.

### 7.4 Idle drift

3–8px of travel, 1–3° of rotation, over 6–14s, per-sticker
`animation-delay` so nothing is in phase. Vary durations by prime-ish
numbers so the field never resynchronizes. Off entirely under
`@media (prefers-reduced-motion: reduce)` — drag still works, it's
user-initiated.

### 7.5 Persistence

`localStorage` key `y2k:sticker-positions`, one
`Record<StickerId, {x: number; y: number}>`, written debounced ~400ms
after drag end. Read in a `useEffect` on mount (never during render).
Unknown ids ignored; missing ids fall back to `home`. Include a
"shake it up" control that clears storage and re-scatters to home
positions with a spring transition.

### 7.6 Layering against header content

- Sticker field: `position: absolute; inset: 0`, `pointer-events: none`
  on the container
- Each sticker sets `pointer-events: auto` on itself — gaps between
  stickers pass clicks through
- Header content (title, CTA, countdown) sits in a sibling layer at a
  higher `z-index`, `pointer-events: auto`
- Stickers promoted during drag land below the content layer — cap the
  promoted z-index

### 7.7 Accessibility

- Stickers are decorative: `aria-hidden="true"` on the field, no tab
  stops, no keyboard drag
- If a sticker ever carries real information, it stops being decorative
  and needs a different treatment — flag rather than guess
- Every piece of header content must be fully usable with the sticker
  field ignored

### 7.8 Performance

- 20–30 stickers max in the DOM
- `will-change: transform` only during an active drag
- No filters/`backdrop-filter` on stickers; drop shadows as static SVG
  `feDropShadow` or a baked offset shape, not a CSS `filter` on an
  animated element
- Drift animations run on the compositor only (`transform`/`opacity`,
  never `top`/`left`/`margin`)

## 8. Build order

1. Scaffold `StickerHeader` with 3 placeholder stickers on the new
   checker/dot surface, static positions, no motion — confirm layering
   and that clicks pass through gaps to the content layer, and confirm
   the old spinner is removed cleanly
2. Add `useStickerDrag` — pointer capture, rAF batching, bounds,
   z-promotion, with those 3
3. Test drag on a real touch device (or emulation) and tune the
   scroll-intent threshold before scaling up — **pause here for review**
4. Add idle drift on the inner layer, confirm it composes with drag and
   doesn't reset on release
5. Author the full 22-sticker set per section 5
6. Persistence + shake-it-up control
7. Reduced-motion pass, then a Performance-panel pass checking for layout
   thrash during drag
