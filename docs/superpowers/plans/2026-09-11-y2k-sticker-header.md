# Y2K Sticker Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hero panel's flat gradient background in `components/AudreySite.tsx` with a field of 22 individually draggable, hand-authored Y2K sticker SVGs sitting on the site's own checker/dot surface.

**Architecture:** A static `STICKERS` registry (hardcoded positions — never generated at render time, to avoid hydration mismatches) drives a `StickerField` client component. Each sticker nests an imperative outer div (pointer-driven drag, written via `useStickerDrag`) around a declarative inner div (CSS drift animation) around a static inline SVG. Positions persist to `localStorage`, debounced.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.8, TypeScript strict, inline SVG (no `next/image`, no sprite sheet), Pointer Events API (no drag library), plain CSS keyframes + `requestAnimationFrame` (no animation library). Verification uses `tsc --noEmit`, `npm run lint`, and small `tsx`-run `node:assert/strict` scripts — there is no test framework in this repo (confirmed: no `jest`/`vitest`/`playwright` in `package.json`, no `*.test.*` files anywhere), so introducing one is out of scope; `tsx` is already a devDependency (used for Drizzle scripting) and is reused here as the plain-Node script runner.

**Spec:** `docs/superpowers/specs/2026-09-11-y2k-sticker-header-design.md`

## Global Constraints

- Next.js App Router, TypeScript strict mode (from `tsconfig.json`: `"strict": true`) — every new file must typecheck under `npx tsc --noEmit`.
- Sticker artwork is inline SVG React components only — no `<img>`, no sprite sheet (per spec §1; fills/gradients must stay addressable).
- No drag library — Pointer Events API directly (per spec §7.3).
- `home`, `rotation`, `layer`, `drift` on every `StickerDef` are hardcoded literals, never computed at render time (per spec §7.1) — this avoids an App Router hydration mismatch.
- Each sticker fits a 100×100 `viewBox`, artwork inset ~6 units, unless it's one of the pieces the manifest specifically designs to bleed off the sticker's own edge (mp3 player's earbud cord, the belt fragment, the book stack's bookmark ribbon) — those run to the viewBox edge on purpose (per spec §1 / §5).
- Natural render size 48–130px per sticker, varied per spec §6's scale tiers — never uniform.
- Outline ink is `#2b0a1e`, not `#000` (per spec §3). Die-cut border is white, ~3–4 units at 100-viewBox scale, on every sticker's main silhouette (per spec §3).
- Chrome is a hard-banded grey→white→grey gradient (per spec §3) — the one gradient technique besides the rainbow arc/streak, which uses hard stops, not a smooth blend (per spec §5, #7 and #17).
- `#00ff9d` screen-accent color appears in exactly three places — the flip phone screen, the brick phone screen, and the NO SIGNAL sticker — each on a `#2b0a1e` chip (per spec §3). Do not use it elsewhere.
- Stickers are decorative: `aria-hidden="true"` on the field container, no tab stops, no keyboard drag (per spec §7.7).
- 20–30 stickers max in the DOM; `will-change: transform` only during an active drag; no CSS `filter`/`backdrop-filter` on stickers; drift animations touch only `transform`/`opacity` (per spec §7.8).
- Drift is disabled entirely under `@media (prefers-reduced-motion: reduce)`; drag still works, since it's user-initiated (per spec §7.4).

---

### Task 1: Palette constants and shared SVG defs

**Files:**
- Create: `lib/stickers/palette.ts`
- Create: `lib/stickers/shared-defs.tsx`
- Create: `lib/stickers/verify-shared-defs.tsx` (throwaway verification script, deleted at the end of this task's step 4)

**Interfaces:**
- Produces: `INK`, `PINK`, `PINK_SOFT`, `TEAL`, `TEAL_SOFT`, `GOLD`, `GOLD_SOFT`, `LAVENDER`, `LAVENDER_SOFT`, `RUST`, `CREAM`, `SCREEN_BG`, `SCREEN_TEXT`, `SILVER` (all `string`, from `lib/stickers/palette.ts`); `DieCutShape` (component, props `{ d: string; fill: string; ink?: string; borderWidth?: number; inkWidth?: number; fillRule?: "nonzero" | "evenodd" }`), `ChromeGradient` (component, props `{ id: string; x1?: string; y1?: string; x2?: string; y2?: string }`), `RainbowGradient` (component, props `{ id: string; x1?: string; y1?: string; x2?: string; y2?: string }`), `HalftonePattern` (component, props `{ id: string; color: string; cell?: number; dot?: number }`), `CheckerPattern` (component, props `{ id: string; cell?: number }`) — all from `lib/stickers/shared-defs.tsx`. Every later sticker Art component imports from these two files.

- [ ] **Step 1: Write `lib/stickers/palette.ts`**

```ts
// lib/stickers/palette.ts
// Color roles for the sticker set — see docs/superpowers/specs/2026-09-11-y2k-sticker-header-design.md §3.
// These are deliberately plain hex strings (not CSS custom properties): each
// sticker is a standalone SVG that may render before the page's --accent
// custom property is available, and the values here are fixed regardless of
// the site's --accent anyway (the sticker set is its own closed palette).

export const INK = "#2b0a1e"; // outline "black" — warm, not true black
export const PINK = "#ff2d95";
export const PINK_SOFT = "#ff8ec9";
export const TEAL = "#009a9a";
export const TEAL_SOFT = "#7de3e3";
export const GOLD = "#ffb300";
export const GOLD_SOFT = "#ffe680";
export const LAVENDER = "#7a4dff";
export const LAVENDER_SOFT = "#c9a7ff";
export const RUST = "#a8330f"; // Adrianne Lenker's swatch — used sparingly
export const CREAM = "#faf2f5";
export const SCREEN_BG = INK; // the LCD-chip background is the same ink color
export const SCREEN_TEXT = "#00ff9d"; // reused from the site's own equalizer/badge — 3 uses only, see Global Constraints
export const SILVER = "#c7c7c7";
```

- [ ] **Step 2: Write `lib/stickers/shared-defs.tsx`**

```tsx
// lib/stickers/shared-defs.tsx
// Reusable SVG building blocks shared across sticker Art components. Each
// component that uses these is rendered exactly once in the registry (no
// sticker type is instantiated twice), so hardcoded-per-file `id` props are
// enough to avoid <defs> id collisions across the ~22 inline SVGs that all
// share one DOM — no need for React's useId() here.
import type { CSSProperties } from "react";
import { CREAM, INK, PINK, TEAL, GOLD, LAVENDER, RUST } from "./palette";

/**
 * Renders a filled shape with the sticker-sheet die-cut treatment: a thick
 * white outer border, then the real fill with a hard ink outline on top.
 * Use this once per sticker for the main silhouette. Internal details
 * (screens, buttons, small accents) are drawn as plain shapes without this
 * wrapper — real sticker sheets only die-cut the outer contour.
 */
export function DieCutShape({
  d,
  fill,
  ink = INK,
  borderWidth = 9,
  inkWidth = 3,
  fillRule,
}: {
  d: string;
  fill: string;
  ink?: string;
  borderWidth?: number;
  inkWidth?: number;
  fillRule?: "nonzero" | "evenodd";
}) {
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="#fff"
        strokeWidth={borderWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fillRule={fillRule}
      />
      <path
        d={d}
        fill={fill}
        stroke={ink}
        strokeWidth={inkWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fillRule={fillRule}
      />
    </>
  );
}

/** Hard-banded grey→white→grey chrome gradient (per spec §3 — the only
 * gradient besides the rainbow arc/streak, and even this one is three flat
 * bands with a sharp cut at each boundary, not a soft blend). Two `<stop>`s
 * at the same offset is what actually produces a hard edge in SVG: offsets
 * are required to be non-decreasing in document order, so the pair must be
 * interleaved with the rest in ascending order — appending a second pass
 * of "hard" stops after stop offset 1 is already reached clamps every one
 * of them back up to 1 and silently erases the band effect. */
export function ChromeGradient({
  id,
  x1 = "0",
  y1 = "0",
  x2 = "0",
  y2 = "1",
}: {
  id: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}) {
  const grey = "#8a8a8a";
  const white = "#ffffff";
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset={0} stopColor={grey} />
      <stop offset={1 / 3} stopColor={grey} />
      <stop offset={1 / 3} stopColor={white} />
      <stop offset={2 / 3} stopColor={white} />
      <stop offset={2 / 3} stopColor={grey} />
      <stop offset={1} stopColor={grey} />
    </linearGradient>
  );
}

/** Six-band hard-cut refraction arc using the site's own accent family, per
 * spec §5 (#7 CD-R) and §5 (#17 vinyl record) — six equal flat-color bands
 * (pink, teal, gold, lavender, rust, pink) with a sharp cut at each of the
 * five internal boundaries, built the same way as ChromeGradient: each
 * band contributes a start and end `<stop>` at the same color, and two
 * adjacent bands share their boundary offset with different colors, which
 * is what creates the hard edge (see ChromeGradient's comment for why the
 * offsets must be interleaved, not appended). */
export function RainbowGradient({
  id,
  x1 = "0",
  y1 = "0",
  x2 = "1",
  y2 = "0",
}: {
  id: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
}) {
  const colors = [PINK, TEAL, GOLD, LAVENDER, RUST, PINK];
  const stops: { offset: number; color: string }[] = [];
  colors.forEach((color, i) => {
    stops.push({ offset: i / colors.length, color });
    stops.push({ offset: (i + 1) / colors.length, color });
  });
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {stops.map((s, i) => (
        <stop key={i} offset={s.offset} stopColor={s.color} />
      ))}
    </linearGradient>
  );
}

/** Dot-grid halftone pattern at a single color — combine with a fill-color
 * rect and opacity/gradient mask on the consumer side to get a fade. */
export function HalftonePattern({
  id,
  color,
  cell = 4,
  dot = 1.1,
}: {
  id: string;
  color: string;
  cell?: number;
  dot?: number;
}) {
  return (
    <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">
      <circle cx={cell / 2} cy={cell / 2} r={dot} fill={color} />
    </pattern>
  );
}

/** Two-tone checker, matching the panel's own backing-surface recipe
 * (spec §4: #e6cfdd / #f6ebf1). */
export function CheckerPattern({ id, cell = 10 }: { id: string; cell?: number }) {
  const half = cell / 2;
  return (
    <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">
      <rect width={cell} height={cell} fill="#f6ebf1" />
      <rect width={half} height={half} fill="#e6cfdd" />
      <rect x={half} y={half} width={half} height={half} fill="#e6cfdd" />
    </pattern>
  );
}

/** Shared style object for a sticker's root <svg> — callers spread this
 * alongside their own width/height (the natural render size from the
 * registry) so every sticker is a fixed-aspect square viewBox. */
export const STICKER_SVG_STYLE: CSSProperties = { display: "block", overflow: "visible" };

export const VIEWBOX = "0 0 100 100";
export { CREAM };
```

- [ ] **Step 3: Write and run the verification script**

```ts
// lib/stickers/verify-shared-defs.tsx (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DieCutShape,
  ChromeGradient,
  RainbowGradient,
  HalftonePattern,
  CheckerPattern,
  VIEWBOX,
} from "./shared-defs";

// DieCutShape renders a white backing path and a filled/inked path on top.
const shapeMarkup = renderToStaticMarkup(<DieCutShape d="M0 0 L10 0 L10 10 Z" fill="#ff2d95" />);
assert.match(shapeMarkup, /stroke="#fff"/);
assert.match(shapeMarkup, /fill="#ff2d95"/);
assert.match(shapeMarkup, /stroke="#2b0a1e"/);

// Extracts [offset, stopColor] pairs from rendered <stop> markup, in
// document order — this is what actually proves (or disproves) a hard
// edge: SVG stop offsets must be non-decreasing, and two stops sharing the
// same offset with different colors is what a hard band edge is, in the
// rendered markup. A test that only checks each color's hex string
// appears somewhere (as the previous version of this script did) cannot
// tell a genuine hard-banded gradient apart from a smoothly interpolated
// one with the same color set — this one can.
function extractStops(markup: string): [number, string][] {
  // React's server renderer emits the raw SVG presentation attribute name
  // (kebab-case "stop-color"), not the JSX prop name "stopColor" — matched
  // and confirmed by hand against actual renderToStaticMarkup output.
  const re = /<stop offset="([^"]*)" stop-color="([^"]*)"/g;
  const out: [number, string][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) out.push([Number(m[1]), m[2]]);
  return out;
}

// ChromeGradient: 6 stops, offsets non-decreasing, and a genuine hard edge
// (two stops at the same offset, different colors) at both 1/3 and 2/3.
const chromeMarkup = renderToStaticMarkup(
  <svg>
    <defs>
      <ChromeGradient id="chrome-test" />
    </defs>
  </svg>,
);
assert.match(chromeMarkup, /id="chrome-test"/);
const chromeStops = extractStops(chromeMarkup);
assert.equal(chromeStops.length, 6, `expected 6 <stop>s, got ${chromeStops.length}`);
for (let i = 1; i < chromeStops.length; i++) {
  assert.ok(chromeStops[i][0] >= chromeStops[i - 1][0], "chrome stop offsets must be non-decreasing");
}
const chromeHardEdges = chromeStops.filter(
  ([offset], i) => i > 0 && offset === chromeStops[i - 1][0] && chromeStops[i][1] !== chromeStops[i - 1][1],
);
assert.equal(chromeHardEdges.length, 2, "chrome gradient must have exactly 2 hard edges (grey/white, white/grey)");

// RainbowGradient: 12 stops (6 bands x 2), offsets non-decreasing, covers
// all 5 accent colors, and has a genuine hard edge at each of the 5
// internal band boundaries.
const rainbowMarkup = renderToStaticMarkup(
  <svg>
    <defs>
      <RainbowGradient id="rainbow-test" />
    </defs>
  </svg>,
);
for (const color of ["#ff2d95", "#009a9a", "#ffb300", "#7a4dff", "#a8330f"]) {
  assert.match(rainbowMarkup, new RegExp(color));
}
const rainbowStops = extractStops(rainbowMarkup);
assert.equal(rainbowStops.length, 12, `expected 12 <stop>s, got ${rainbowStops.length}`);
for (let i = 1; i < rainbowStops.length; i++) {
  assert.ok(rainbowStops[i][0] >= rainbowStops[i - 1][0], "rainbow stop offsets must be non-decreasing");
}
const rainbowHardEdges = rainbowStops.filter(
  ([offset], i) => i > 0 && offset === rainbowStops[i - 1][0] && rainbowStops[i][1] !== rainbowStops[i - 1][1],
);
assert.equal(rainbowHardEdges.length, 5, "rainbow gradient must have exactly 5 hard edges (one per internal band boundary)");

// Pattern defs render with the requested id and a dot/checker child.
const halftoneMarkup = renderToStaticMarkup(
  <svg>
    <defs>
      <HalftonePattern id="halftone-test" color="#ff2d95" />
    </defs>
  </svg>,
);
assert.match(halftoneMarkup, /id="halftone-test"/);
assert.match(halftoneMarkup, /<circle/);

const checkerMarkup = renderToStaticMarkup(
  <svg>
    <defs>
      <CheckerPattern id="checker-test" />
    </defs>
  </svg>,
);
assert.match(checkerMarkup, /id="checker-test"/);
assert.equal((checkerMarkup.match(/<rect/g) ?? []).length, 3);

assert.equal(VIEWBOX, "0 0 100 100");

console.log("PASS: lib/stickers/shared-defs.tsx");
```

Run: `npx tsx lib/stickers/verify-shared-defs.tsx`
Expected: prints `PASS: lib/stickers/shared-defs.tsx` with no assertion errors.

- [ ] **Step 4: Typecheck, then delete the throwaway script**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
rm lib/stickers/verify-shared-defs.tsx
```

- [ ] **Step 5: Commit**

```bash
git add lib/stickers/palette.ts lib/stickers/shared-defs.tsx
git commit -m "Add sticker palette constants and shared SVG defs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 2: Sticker registry types and 3 placeholder stickers

**Files:**
- Create: `lib/stickers/registry.ts`
- Create: `lib/stickers/art/placeholder-a.tsx`
- Create: `lib/stickers/art/placeholder-b.tsx`
- Create: `lib/stickers/art/placeholder-c.tsx`
- Create: `lib/stickers/verify-registry.ts` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: `DieCutShape`, `VIEWBOX`, `STICKER_SVG_STYLE` (from `lib/stickers/shared-defs.tsx`, Task 1); `PINK`, `TEAL`, `GOLD` (from `lib/stickers/palette.ts`, Task 1)
- Produces: `StickerId` (`type StickerId = string`), `StickerDef` (interface, per Global Constraints), `STICKERS: StickerDef[]` (from `lib/stickers/registry.ts` — 3 entries in this task, replaced with the full 22 in Task 9). Every sticker Art component has the signature `React.FC<{ className?: string }>`.

- [ ] **Step 1: Write the 3 placeholder Art components**

```tsx
// lib/stickers/art/placeholder-a.tsx
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK } from "../palette";

export default function PlaceholderA({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M50 10 A40 40 0 1 1 49.9 10 Z" fill={PINK} />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/placeholder-b.tsx
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { TEAL } from "../palette";

export default function PlaceholderB({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M14 14 L86 14 L86 86 L14 86 Z" fill={TEAL} />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/placeholder-c.tsx
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { GOLD } from "../palette";

export default function PlaceholderC({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M50 12 L86 82 L14 82 Z" fill={GOLD} />
    </svg>
  );
}
```

- [ ] **Step 2: Write `lib/stickers/registry.ts`**

```ts
// lib/stickers/registry.ts
// See docs/superpowers/specs/2026-09-11-y2k-sticker-header-design.md §7.1.
// home/rotation/layer/drift are hardcoded literals, never computed at
// render time — random placement here would produce an App Router
// hydration mismatch and the stickers would visibly jump on load.
import type { FC } from "react";
import PlaceholderA from "./art/placeholder-a";
import PlaceholderB from "./art/placeholder-b";
import PlaceholderC from "./art/placeholder-c";

export type StickerId = string;

export interface StickerDef {
  id: StickerId;
  Art: FC<{ className?: string }>;
  size: number; // px, natural width
  home: { x: number; y: number }; // % of header box, 0-100
  rotation: number; // deg, -18..18
  layer: number; // base z-index, 0..n
  drift: { amplitude: number; duration: number; delay: number };
}

// Placeholder set for Task 2/3/4/5 (scaffold, drag, drift). Replaced with
// the full 22-sticker set in Task 9 — see that task for the real manifest.
export const STICKERS: StickerDef[] = [
  {
    id: "placeholder-a",
    Art: PlaceholderA,
    size: 90,
    home: { x: 70, y: 30 },
    rotation: -8,
    layer: 1,
    drift: { amplitude: 6, duration: 9, delay: 0 },
  },
  {
    id: "placeholder-b",
    Art: PlaceholderB,
    size: 70,
    home: { x: 85, y: 65 },
    rotation: 11,
    layer: 2,
    drift: { amplitude: 5, duration: 11, delay: 1.4 },
  },
  {
    id: "placeholder-c",
    Art: PlaceholderC,
    size: 60,
    home: { x: 60, y: 75 },
    rotation: -14,
    layer: 3,
    drift: { amplitude: 4, duration: 13, delay: 2.7 },
  },
];
```

- [ ] **Step 3: Write and run the verification script**

```ts
// lib/stickers/verify-registry.ts (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { STICKERS } from "./registry";

assert.equal(STICKERS.length, 3);
const ids = STICKERS.map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, "sticker ids must be unique");

for (const s of STICKERS) {
  assert.ok(s.size >= 48 && s.size <= 130, `${s.id} size ${s.size} out of 48-130 range`);
  assert.ok(s.rotation >= -18 && s.rotation <= 18, `${s.id} rotation ${s.rotation} out of -18..18 range`);
  assert.ok(s.home.x >= 0 && s.home.x <= 100, `${s.id} home.x out of 0-100 range`);
  assert.ok(s.home.y >= 0 && s.home.y <= 100, `${s.id} home.y out of 0-100 range`);
  assert.ok(typeof s.Art === "function", `${s.id} Art must be a component`);
}

console.log("PASS: lib/stickers/registry.ts");
```

Run: `npx tsx lib/stickers/verify-registry.ts`
Expected: prints `PASS: lib/stickers/registry.ts`.

- [ ] **Step 4: Typecheck, then delete the throwaway script**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
rm lib/stickers/verify-registry.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/stickers/registry.ts lib/stickers/art/placeholder-a.tsx lib/stickers/art/placeholder-b.tsx lib/stickers/art/placeholder-c.tsx
git commit -m "Add sticker registry types and 3 placeholder stickers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 3: StickerField scaffold wired into the hero panel

**Files:**
- Create: `components/stickers/StickerField.tsx`
- Modify: `components/AudreySite.tsx:187-290` (the hero panel `<div>` and its inner content wrapper)

**Interfaces:**
- Consumes: `STICKERS`, `StickerDef` (from `lib/stickers/registry.ts`, Task 2); `CheckerPattern` (from `lib/stickers/shared-defs.tsx`, Task 1)
- Produces: `StickerField` (component, no props — reads `STICKERS` directly), default-exported from `components/stickers/StickerField.tsx`. Task 4 imports and wraps this component's per-sticker markup with drag handlers; Task 5 adds the drift div this task already scaffolds.

- [ ] **Step 1: Write `components/stickers/StickerField.tsx`**

No drag or drift yet — this step only proves layering and static placement. `data-sticker` and `data-drift` divs are present (per spec §7.2) so Tasks 4 and 5 attach behavior without restructuring the DOM.

```tsx
// components/stickers/StickerField.tsx
"use client";

import { STICKERS } from "@/lib/stickers/registry";
import { CheckerPattern } from "@/lib/stickers/shared-defs";

export default function StickerField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // Explicit z-index (not just non-static position) is what makes
        // this a stacking context of its own — without it, a sticker's
        // internal z-index (up to ~1000+ once promoted by drag, see Task
        // 4) would compare directly against the content layer's z-index
        // in AudreySite.tsx and could render above the title. With it,
        // every descendant's z-index is scoped inside this "1" and can
        // never escape above a sibling layer with a higher z-index (per
        // spec §7.6 — content must stay above stickers even mid-drag).
        zIndex: 1,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <CheckerPattern id="sticker-field-checker" />
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url(#sticker-field-checker)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 10% 6%, rgba(125,227,227,0.4), transparent 42%)," +
            "radial-gradient(circle at 92% 3%, rgba(255,95,176,0.34), transparent 40%)," +
            "radial-gradient(circle at 72% 94%, rgba(255,230,128,0.34), transparent 46%)," +
            "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.95) 1.6px, transparent 2.2px)",
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 24px 24px",
        }}
      />
      {STICKERS.map((s) => (
        <div
          key={s.id}
          data-sticker={s.id}
          style={{
            position: "absolute",
            left: `${s.home.x}%`,
            top: `${s.home.y}%`,
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            zIndex: s.layer,
            pointerEvents: "auto",
          }}
        >
          <div data-drift style={{ width: "100%", height: "100%" }}>
            <s.Art className="" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

Note: `background: url(#sticker-field-checker)` referencing a `<pattern>` defined in a zero-size sibling `<svg>` works in all evergreen browsers via document-wide id lookup, and keeps the checker recipe defined once (shared-defs) instead of duplicated as a CSS gradient.

- [ ] **Step 2: Read `components/AudreySite.tsx:187-290` before editing**

Confirm the exact current content of the hero panel `<div>` (the one with the `linear-gradient(180deg, var(--accent-soft)...)` background) and the decorative spinner block (the `<div>` with `background: "conic-gradient(from 200deg, ...)"` and its `cd-spin` animation) so the edit below applies cleanly.

- [ ] **Step 3: Wire `StickerField` into the hero panel, remove the decorative spinner**

In `components/AudreySite.tsx`:

1. Add the import:

```tsx
import StickerField from "@/components/stickers/StickerField";
```

2. Replace the hero panel's `background` from the gradient to a solid fallback color (the checker now comes from `StickerField`, painted as a sibling layer):

```tsx
// Before:
              background:
                "linear-gradient(180deg, var(--accent-soft) 0%, var(--accent) 48%, var(--accent-dark) 52%, var(--accent) 100%)",
// After:
              background: "#f6ebf1",
```

3. Render `<StickerField />` as the first child of that panel `<div>`, before the existing top-sheen overlay `<div>`:

```tsx
            <StickerField />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(rgba(255,255,255,0.42), rgba(255,255,255,0))",
                // StickerField's root now carries an explicit zIndex: 1 (see
                // its own file) so it can contain drag-promoted sticker
                // z-indexes below the content layer. That has a side
                // effect: a sibling with no z-index at all (auto) paints
                // *underneath* any positioned sibling that has an explicit
                // positive z-index, regardless of DOM order — so without
                // this line, the sheen would render fully hidden behind
                // StickerField's opaque checker background. Giving it the
                // same z-index (1) puts it in the same paint tier, where
                // DOM order (this div comes after StickerField) breaks the
                // tie in the sheen's favor, restoring it above the checker
                // and still below the title wrapper's zIndex: 2.
                zIndex: 1,
                // Tying the sheen's z-index with StickerField's also ties
                // their hit-test order the same way (the browser hit-tests
                // in reverse paint order — whatever paints last, on top,
                // is also hit first) — so without this, the sheen (now on
                // top) would silently swallow pointer events meant for any
                // sticker underneath it in this top-half band, once Task 4
                // wires up drag handlers. `pointerEvents: "none"` keeps the
                // sheen purely visual, matching the pattern StickerField's
                // own root already uses for the same reason.
                pointerEvents: "none",
              }}
            />
```

Reduce that sheen's opacity from `0.42` to `0.22` per spec §2 (enough gloss without washing out the checker).

4. Delete the decorative spinner `<div>` entirely (the block with `conic-gradient(from 200deg, ...)`, `animation: "cd-spin 9s linear infinite"`, and its inner white-ringed circle) — per spec §2, the CD-R and vinyl-record stickers now own that motif.

5. The `<div>` that wraps the title/CTA/countdown block currently sits in a flex row alongside the spinner (`justifyContent: "space-between"`); since the spinner's sibling is now gone, that wrapping `<div>`'s `justifyContent: "space-between"` has nothing to space against — change it to `justifyContent: "flex-start"` so the title block doesn't stretch to fill the row oddly.

6. Give that same title-block wrapper a higher `zIndex` (e.g. `2`) and keep `position: "relative"` (already present) so it stacks above `StickerField`'s `inset: 0` layer, per spec §7.6.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the site in a browser.
Expected:
- The hero panel shows the pastel checker/dot/bloom surface (no more solid pink gradient, no spinner).
- The 3 placeholder shapes (pink circle, teal square, gold triangle) sit at their `home` positions, static, no motion.
- Clicking/hovering the gaps between placeholders does nothing (pointer-events pass through); clicking the title, CTA buttons, and countdown text still works.
- Clicking directly on a placeholder shape does nothing yet (drag isn't wired until Task 4) but doesn't error either.

- [ ] **Step 6: Commit**

```bash
git add components/stickers/StickerField.tsx components/AudreySite.tsx
git commit -m "Scaffold StickerField in the hero panel, remove decorative spinner

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 4: `useStickerDrag` hook

**Files:**
- Create: `hooks/useStickerDrag.ts`
- Modify: `components/stickers/StickerField.tsx`
- Create: `hooks/verify-clamp.ts` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: none beyond React/DOM APIs.
- Produces: `clampTranslate(dx: number, dy: number, size: number, containerWidth: number, containerHeight: number, homeXPct: number, homeYPct: number): { x: number; y: number }` (pure function, exported for the verification script and reused by the hook); `useStickerDrag(containerRef: React.RefObject<HTMLElement | null>): { bind: (id: string, homeXPct: number, homeYPct: number, size: number) => React.DOMAttributes<HTMLDivElement> }` (hook, default export path `hooks/useStickerDrag.ts`). Task 3's `StickerField` calls `bind(...)` and spreads the result onto each `data-sticker` div; Task 9's persistence work reads the same translate values this hook writes.

- [ ] **Step 1: Write `hooks/useStickerDrag.ts`**

```ts
// hooks/useStickerDrag.ts
"use client";

import { useCallback, useRef } from "react";

/**
 * Clamps a proposed drag translate (dx, dy, relative to the sticker's home
 * position) so at least 60% of the sticker stays inside the container.
 * Pure and side-effect-free so it's independently testable — see
 * hooks/verify-clamp.ts.
 */
export function clampTranslate(
  dx: number,
  dy: number,
  size: number,
  containerWidth: number,
  containerHeight: number,
  homeXPct: number,
  homeYPct: number,
): { x: number; y: number } {
  const homeX = (homeXPct / 100) * containerWidth;
  const homeY = (homeYPct / 100) * containerHeight;
  const visible = size * 0.6; // at least 60% of the sticker must stay inside
  const minX = -homeX - size / 2 + visible;
  const maxX = containerWidth - homeX - size / 2 - visible + size;
  const minY = -homeY - size / 2 + visible;
  const maxY = containerHeight - homeY - size / 2 - visible + size;
  return {
    x: Math.min(Math.max(dx, minX), maxX),
    y: Math.min(Math.max(dy, minY), maxY),
  };
}

let topZ = 1000;

export function useStickerDrag(containerRef: React.RefObject<HTMLElement | null>) {
  // One ref per sticker id, holding its live translate — read/written
  // outside React state so pointermove never triggers a re-render.
  const translateRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    id: string;
    el: HTMLDivElement;
    driftEl: HTMLElement | null;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    size: number;
    homeXPct: number;
    homeYPct: number;
  } | null>(null);

  const applyTransform = useCallback((el: HTMLDivElement, x: number, y: number, z: number) => {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.zIndex = String(z);
  }, []);

  const scheduleWrite = useCallback((el: HTMLDivElement, x: number, y: number, z: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyTransform(el, x, y, z);
      rafRef.current = null;
    });
  }, [applyTransform]);

  const bind = useCallback(
    (id: string, homeXPct: number, homeYPct: number, size: number) => {
      const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const current = translateRef.current.get(id) ?? { x: 0, y: 0 };
        const driftEl = el.querySelector<HTMLElement>("[data-drift]");
        if (driftEl) driftEl.style.animationPlayState = "paused";
        el.style.willChange = "transform";
        topZ += 1;
        dragRef.current = {
          id,
          el,
          driftEl,
          startX: e.clientX,
          startY: e.clientY,
          baseX: current.x,
          baseY: current.y,
          size,
          homeXPct,
          homeYPct,
        };
        applyTransform(el, current.x, current.y, topZ);
      };

      const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const rawDx = drag.baseX + (e.clientX - drag.startX);
        const rawDy = drag.baseY + (e.clientY - drag.startY);
        const clamped = clampTranslate(rawDx, rawDy, drag.size, rect.width, rect.height, drag.homeXPct, drag.homeYPct);
        translateRef.current.set(id, clamped);
        scheduleWrite(drag.el, clamped.x, clamped.y, topZ);
      };

      const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        drag.el.style.willChange = "";
        if (drag.driftEl) drag.driftEl.style.animationPlayState = "running";
        dragRef.current = null;
      };

      return {
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
      };
    },
    [applyTransform, scheduleWrite, containerRef],
  );

  return { bind };
}
```

- [ ] **Step 2: Wire `bind` into `StickerField`**

In `components/stickers/StickerField.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { STICKERS } from "@/lib/stickers/registry";
import { CheckerPattern } from "@/lib/stickers/shared-defs";
import { useStickerDrag } from "@/hooks/useStickerDrag";

export default function StickerField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bind } = useStickerDrag(containerRef);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // See Task 3's identical comment: this z-index makes the field its
        // own stacking context, so promoted drag z-indexes never escape
        // above the content layer in AudreySite.tsx.
        zIndex: 1,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <CheckerPattern id="sticker-field-checker" />
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url(#sticker-field-checker)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 10% 6%, rgba(125,227,227,0.4), transparent 42%)," +
            "radial-gradient(circle at 92% 3%, rgba(255,95,176,0.34), transparent 40%)," +
            "radial-gradient(circle at 72% 94%, rgba(255,230,128,0.34), transparent 46%)," +
            "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.95) 1.6px, transparent 2.2px)",
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 24px 24px",
        }}
      />
      {STICKERS.map((s) => (
        <div
          key={s.id}
          data-sticker={s.id}
          {...bind(s.id, s.home.x, s.home.y, s.size)}
          style={{
            position: "absolute",
            left: `${s.home.x}%`,
            top: `${s.home.y}%`,
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            zIndex: s.layer,
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          <div data-drift style={{ width: "100%", height: "100%" }}>
            <s.Art className="" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

Note: `touchAction: "none"` is applied per-sticker here, matching the plain pointer-capture drag added in this task. Task 5 doesn't change this; the scroll-intent threshold from spec §7.3 is a deliberate deferred refinement — flagged at the end of this task's manual verification step, to be tuned during the task's own touch-device check per the spec's build order (step 3: "tune the scroll-intent threshold before scaling up").

- [ ] **Step 3: Write and run the `clampTranslate` verification script**

```ts
// hooks/verify-clamp.ts (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { clampTranslate } from "./useStickerDrag";

// A sticker at home (50%, 50%) in a 400x300 container, size 80: no drag yet.
const centered = clampTranslate(0, 0, 80, 400, 300, 50, 50);
assert.deepEqual(centered, { x: 0, y: 0 });

// Dragging far to the right clamps so 60% of the sticker stays inside.
const draggedRight = clampTranslate(10000, 0, 80, 400, 300, 50, 50);
assert.ok(draggedRight.x < 10000, "drag right must be clamped");
assert.ok(draggedRight.x > 0, "clamped drag right must still be positive");

// Dragging far off the top-left clamps too.
const draggedTopLeft = clampTranslate(-10000, -10000, 80, 400, 300, 50, 50);
assert.ok(draggedTopLeft.x > -10000 && draggedTopLeft.y > -10000);

// A small in-bounds drag passes through unclamped.
const small = clampTranslate(20, -15, 80, 400, 300, 50, 50);
assert.deepEqual(small, { x: 20, y: -15 });

console.log("PASS: hooks/useStickerDrag.ts clampTranslate");
```

Run: `npx tsx hooks/verify-clamp.ts`
Expected: prints `PASS: hooks/useStickerDrag.ts clampTranslate`.

- [ ] **Step 4: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm hooks/verify-clamp.ts
```

- [ ] **Step 5: Manual verification — CHECKPOINT, pause for review here**

Run: `npm run dev`, open the site in a browser (and in a real touch device or device emulation, per the spec's own build order).
Expected:
- Each placeholder can be picked up and dragged with the mouse; it stays under the pointer with no lag, and releases where dropped.
- Dragging a placeholder promotes it above the other two visually, but it never renders above the title/CTA text.
- A placeholder dragged hard toward any edge stops before it fully leaves the panel (60% stays visible).
- On touch: dragging currently claims the gesture immediately (no scroll-intent threshold yet — that's expected at this checkpoint, not a bug). Note whether page scroll feels trapped when starting a touch drag near a sticker; this observation drives whether the scroll-intent threshold (spec §7.3) needs to land before or alongside Task 5.

This is the spec's own "pause after step 3" checkpoint — stop and get sign-off here before continuing to idle drift and the full art set.

- [ ] **Step 6: Commit**

```bash
git add hooks/useStickerDrag.ts components/stickers/StickerField.tsx
git commit -m "Add useStickerDrag: pointer capture, rAF-batched translate, bounds clamp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 5: Idle drift + touch scroll-intent threshold

**Files:**
- Modify: `app/globals.css`
- Modify: `hooks/useStickerDrag.ts`
- Modify: `components/stickers/StickerField.tsx`

**Interfaces:**
- Consumes: `useStickerDrag` (Task 4) — its `bind` return type gains no new fields, but its `onPointerDown`/`onPointerMove` behavior changes for `pointerType === "touch"`.
- Produces: CSS class `.sticker-drift` (in `app/globals.css`) — applied to each `data-drift` div, with `animation-duration`/`animation-delay` set inline per-sticker from `STICKERS[i].drift`.

- [ ] **Step 1: Add the drift keyframes and class to `app/globals.css`**

```css
/* Sticker idle drift — transform/opacity only, so it stays on the compositor. */
@keyframes sticker-drift {
  0% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(1px, -1px) rotate(0.6deg);
  }
  50% {
    transform: translate(0, -1px) rotate(-0.6deg);
  }
  75% {
    transform: translate(-1px, 0) rotate(0.4deg);
  }
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
}

.sticker-drift {
  width: 100%;
  height: 100%;
  animation-name: sticker-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
```

The keyframes above use a fixed small translate/rotate shape; each sticker's `amplitude` scales it via a CSS custom property so every sticker doesn't drift by the same literal pixel amount:

```css
.sticker-drift {
  width: 100%;
  height: 100%;
  animation-name: sticker-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  --drift-amp: 1;
  transform-origin: 50% 50%;
}

@keyframes sticker-drift {
  0% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(calc(var(--drift-amp) * 1px), calc(var(--drift-amp) * -1px)) rotate(0.6deg);
  }
  50% {
    transform: translate(0, calc(var(--drift-amp) * -1px)) rotate(-0.6deg);
  }
  75% {
    transform: translate(calc(var(--drift-amp) * -1px), 0) rotate(0.4deg);
  }
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sticker-drift {
    animation: none;
  }
}
```

(Remove the first, unscaled `@keyframes sticker-drift` block above before saving the file — it was superseded by this second one in the same step.)

- [ ] **Step 2: Apply the class and per-sticker timing in `StickerField`**

Replace the inner `data-drift` div in `components/stickers/StickerField.tsx`:

```tsx
          <div
            data-drift
            className="sticker-drift"
            style={{
              animationDuration: `${s.drift.duration}s`,
              animationDelay: `${s.drift.delay}s`,
              // amplitude scales the keyframes' fixed 1px/0.6deg shape
              ["--drift-amp" as string]: s.drift.amplitude / 2,
            }}
          >
            <s.Art className="" />
          </div>
```

- [ ] **Step 3: Add the touch scroll-intent threshold to `useStickerDrag`**

Per spec §7.3: on touch, don't claim the gesture (no `setPointerCapture`, no `touch-action: none` yet) until movement is >~8px horizontal and less than that vertical, or a 200ms hold. Vertical-first movement stays a page scroll.

```ts
// hooks/useStickerDrag.ts — replace the bind() function's onPointerDown/onPointerMove with:
      const pendingTouchRef = { current: null as null | { startX: number; startY: number; startT: number; el: HTMLDivElement } };

      const claimDrag = (el: HTMLDivElement, e: React.PointerEvent<HTMLDivElement>) => {
        el.setPointerCapture(e.pointerId);
        el.style.touchAction = "none";
        const current = translateRef.current.get(id) ?? { x: 0, y: 0 };
        const driftEl = el.querySelector<HTMLElement>("[data-drift]");
        if (driftEl) driftEl.style.animationPlayState = "paused";
        el.style.willChange = "transform";
        topZ += 1;
        dragRef.current = {
          id,
          el,
          driftEl,
          startX: e.clientX,
          startY: e.clientY,
          baseX: current.x,
          baseY: current.y,
          size,
          homeXPct,
          homeYPct,
        };
        applyTransform(el, current.x, current.y, topZ);
      };

      const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        if (e.pointerType !== "touch") {
          claimDrag(el, e);
          return;
        }
        // Touch: wait for horizontal intent or a hold before claiming the
        // gesture, so a vertical swipe here still scrolls the page.
        pendingTouchRef.current = { startX: e.clientX, startY: e.clientY, startT: performance.now(), el };
      };

      const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const pending = pendingTouchRef.current;
        if (pending && !dragRef.current) {
          const dx = Math.abs(e.clientX - pending.startX);
          const dy = Math.abs(e.clientY - pending.startY);
          const held = performance.now() - pending.startT > 200;
          if (dx > 8 && dy < 8) {
            claimDrag(pending.el, e);
            pendingTouchRef.current = null;
          } else if (held) {
            claimDrag(pending.el, e);
            pendingTouchRef.current = null;
          } else if (dy >= 8) {
            // Vertical-first — this is a page scroll, not a drag. Stop
            // tracking until the next pointerdown.
            pendingTouchRef.current = null;
            return;
          } else {
            return;
          }
        }
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const rawDx = drag.baseX + (e.clientX - drag.startX);
        const rawDy = drag.baseY + (e.clientY - drag.startY);
        const clamped = clampTranslate(rawDx, rawDy, drag.size, rect.width, rect.height, drag.homeXPct, drag.homeYPct);
        translateRef.current.set(id, clamped);
        scheduleWrite(drag.el, clamped.x, clamped.y, topZ);
      };

      const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        pendingTouchRef.current = null;
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        drag.el.releasePointerCapture(e.pointerId);
        drag.el.style.touchAction = "";
        drag.el.style.willChange = "";
        if (drag.driftEl) drag.driftEl.style.animationPlayState = "running";
        dragRef.current = null;
      };
```

And remove the now-redundant `touchAction: "none"` from `StickerField`'s per-sticker inline style (Task 4 set it unconditionally; this task moves it to be applied only once a touch drag is actually claimed, matching spec §7.3's "Keep `touch-action: none` off the container and apply it to the sticker only once drag is claimed").

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`.
Expected:
- Each placeholder now visibly drifts a few pixels in a slow loop, each on its own timing (they're out of phase — check by watching all 3 for ~15s).
- Starting a drag pauses that sticker's drift immediately; releasing resumes it from a natural-looking point (no snap-back).
- With OS-level "reduce motion" turned on, drift stops entirely on all 3 placeholders; dragging still works.
- On a touch device (or Chrome DevTools device emulation with touch), a vertical swipe starting on a placeholder scrolls the page instead of dragging it; a clearly horizontal drag, or a ~200ms press-and-hold, picks the sticker up.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css hooks/useStickerDrag.ts components/stickers/StickerField.tsx
git commit -m "Add idle drift animation and touch scroll-intent threshold

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 6: Tech-object sticker art (8)

**Files:**
- Create: `lib/stickers/art/mp3-player.tsx`
- Create: `lib/stickers/art/flip-phone.tsx`
- Create: `lib/stickers/art/digicam.tsx`
- Create: `lib/stickers/art/hair-clips.tsx`
- Create: `lib/stickers/art/studded-belt.tsx`
- Create: `lib/stickers/art/platform-boot.tsx`
- Create: `lib/stickers/art/cd-r.tsx`
- Create: `lib/stickers/art/brick-phone.tsx`
- Create: `lib/stickers/verify-tech-art.tsx` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: `DieCutShape`, `ChromeGradient`, `RainbowGradient`, `STICKER_SVG_STYLE`, `VIEWBOX` (Task 1); `INK`, `PINK`, `PINK_SOFT`, `TEAL`, `TEAL_SOFT`, `GOLD`, `LAVENDER`, `SCREEN_BG`, `SCREEN_TEXT`, `SILVER`, `CREAM` (Task 1)
- Produces: 8 default-exported `React.FC<{ className?: string }>` components, one per file above. Task 9 imports all 8 into the final registry.

- [ ] **Step 1: Write the 8 Art components**

```tsx
// lib/stickers/art/mp3-player.tsx
// Per spec §5 #1: click-wheel player, earbud cord trailing off the sticker
// edge, bubblegum pink body, chrome bezel.
import { DieCutShape, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK_SOFT, PINK, CREAM, INK } from "../palette";

export default function Mp3Player({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <linearGradient id="mp3-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PINK_SOFT} />
          <stop offset="1" stopColor={PINK} />
        </linearGradient>
        <ChromeGradient id="mp3-chrome" />
      </defs>
      {/* earbud cord, drawn first so it sits under the body and bleeds off the corner */}
      <path
        d="M38 78 C 30 88, 18 92, -2 102"
        fill="none"
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <DieCutShape d="M34 12 L66 12 Q72 12 72 18 L72 82 Q72 88 66 88 L34 88 Q28 88 28 82 L28 18 Q28 12 34 12 Z" fill="url(#mp3-body)" />
      <rect x="40" y="21" width="20" height="13" rx="2.5" fill="url(#mp3-chrome)" stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="64" r="16" fill="url(#mp3-chrome)" stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="64" r="6" fill={CREAM} stroke={INK} strokeWidth="1.2" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/flip-phone.tsx
// Per spec §5 #2: open, tiny screen, teal shell (recolored from the
// original brief's pink so it doesn't duplicate the mp3 player), silver
// hinge, screen chip reads "1 NEW MSG" in the reused screen-accent color.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { TEAL_SOFT, TEAL, SILVER, SCREEN_BG, SCREEN_TEXT, INK } from "../palette";

export default function FlipPhone({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <linearGradient id="flip-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={TEAL_SOFT} />
          <stop offset="1" stopColor={TEAL} />
        </linearGradient>
      </defs>
      {/* bottom half (keypad body) */}
      <DieCutShape d="M32 52 L68 52 Q74 52 74 58 L74 88 Q74 92 70 92 L30 92 Q26 92 26 88 L26 58 Q26 52 32 52 Z" fill="url(#flip-shell)" />
      {/* top half (screen body), offset up-left to read as "open" */}
      <DieCutShape d="M28 10 L64 10 Q70 10 70 16 L70 46 Q70 50 66 50 L26 50 Q22 50 22 46 L22 16 Q22 10 28 10 Z" fill="url(#flip-shell)" />
      {/* hinge */}
      <rect x="24" y="49" width="48" height="5" rx="2.5" fill={SILVER} stroke={INK} strokeWidth="1" />
      {/* screen chip */}
      <rect x="30" y="18" width="32" height="24" rx="2" fill={SCREEN_BG} />
      <text x="46" y="33" textAnchor="middle" fontFamily="monospace" fontSize="7" fill={SCREEN_TEXT}>
        1 NEW MSG
      </text>
      {/* keypad hint */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={34 + i * 12} y="70" width="8" height="6" rx="1.5" fill={SILVER} opacity="0.85" />
      ))}
    </svg>
  );
}
```

```tsx
// lib/stickers/art/digicam.tsx
// Per spec §5 #3: small point-and-shoot, flash-blowout starburst, chrome
// body, grip recolored to ink (was black — same value in spirit).
import { DieCutShape, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM, GOLD } from "../palette";

export default function Digicam({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="digicam-chrome" x1="0" y1="0" x2="1" y2="0" />
      </defs>
      {/* flash starburst, behind the body */}
      <path
        d="M74 20 L77 27 L84 24 L79 30 L86 34 L78 34 L80 41 L74 36 L68 41 L70 34 L62 34 L69 30 L64 24 L71 27 Z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <DieCutShape d="M18 34 L76 34 Q82 34 82 40 L82 66 Q82 72 76 72 L18 72 Q12 72 12 66 L12 40 Q12 34 18 34 Z" fill="url(#digicam-chrome)" />
      <rect x="18" y="40" width="14" height="8" rx="2" fill={INK} />
      <circle cx="47" cy="53" r="14" fill={INK} />
      <circle cx="47" cy="53" r="9" fill="#3a3a3a" />
      <circle cx="47" cy="53" r="4" fill="url(#digicam-chrome)" />
      <rect x="66" y="40" width="10" height="6" rx="1.5" fill={CREAM} stroke={INK} strokeWidth="1" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/hair-clips.tsx
// Per spec §5 #4: pair of butterfly clips, one chrome/iridescent, one
// recolored to lavender (was matte black).
import { ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { LAVENDER, INK } from "../palette";

function ButterflyWings({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <>
      <path
        d={`M${cx} ${cy} L${cx - 16} ${cy - 10} Q${cx - 22} ${cy - 2} ${cx - 14} ${cy + 4} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx + 16} ${cy - 10} Q${cx + 22} ${cy - 2} ${cx + 14} ${cy + 4} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx - 12} ${cy + 8} Q${cx - 14} ${cy + 14} ${cx - 4} ${cy + 12} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx + 12} ${cy + 8} Q${cx + 14} ${cy + 14} ${cx + 4} ${cy + 12} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <ellipse cx={cx} cy={cy} rx="4" ry="3" fill={INK} />
    </>
  );
}

export default function HairClips({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="clip-chrome" />
      </defs>
      <g transform="translate(-6, -4) rotate(-8 36 40)">
        <ButterflyWings cx={36} cy={40} fill="url(#clip-chrome)" />
      </g>
      <g transform="translate(8, 10) rotate(12 66 62)">
        <ButterflyWings cx={66} cy={62} fill={LAVENDER} />
      </g>
    </svg>
  );
}
```

```tsx
// lib/stickers/art/studded-belt.tsx
// Per spec §5 #5: fragment running diagonally off both sticker edges, ink
// leather, chrome pyramid studs.
import { ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function StuddedBelt({ className }: { className?: string }) {
  const studs = [22, 38, 54, 70, 86];
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="stud-chrome" />
      </defs>
      {/* the strap itself is not die-cut individually inset — it's designed
          to bleed off both edges, per spec §1/§5 */}
      <path d="M-6 74 L106 26 L106 44 L-6 92 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {studs.map((x) => {
        // centerline of the diagonal strap band at this x (the band runs
        // from (-6,74)-(106,26) on top to (-6,92)-(106,44) on the bottom)
        const cy = 83 - ((x + 6) / 112) * 48;
        return (
          <path
            key={x}
            d={`M${x} ${cy - 6} L${x + 6} ${cy} L${x} ${cy + 6} L${x - 6} ${cy} Z`}
            fill="url(#stud-chrome)"
            stroke={INK}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
```

```tsx
// lib/stickers/art/platform-boot.tsx
// Per spec §5 #6: chunky sole, side profile, ink body, laces recolored to
// teal (was red).
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, TEAL, GOLD } from "../palette";

export default function PlatformBoot({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape
        d="M20 30 L52 30 Q60 30 64 38 L80 58 L86 58 Q92 58 92 66 L92 80 Q92 86 86 86 L18 86 Q12 86 12 80 L12 40 Q12 30 20 30 Z"
        fill={INK}
      />
      {/* sole, a lighter band along the bottom */}
      <path d="M14 78 L90 78 L90 84 Q90 86 88 86 L16 86 Q14 86 14 84 Z" fill="#4a3341" />
      {/* laces */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={30 + i * 8} y1={40 + i * 4} x2={44 + i * 8} y2={36 + i * 4} stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      {/* eyelets */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={32 + i * 8} cy={38 + i * 3.5} r="1.6" fill={GOLD} />
      ))}
    </svg>
  );
}
```

```tsx
// lib/stickers/art/cd-r.tsx
// Per spec §5 #7: sharpie handwriting on the label, chrome disc, six-hard-
// stop refraction arc using the full site accent family.
import { DieCutShape, ChromeGradient, RainbowGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM } from "../palette";

export default function CdR({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="cdr-chrome" />
        <RainbowGradient id="cdr-rainbow" />
      </defs>
      <DieCutShape d="M50 8 A42 42 0 1 1 49.9 8 Z" fill="url(#cdr-chrome)" fillRule="evenodd" />
      <path
        d="M50 8 A42 42 0 0 1 92 50"
        fill="none"
        stroke="url(#cdr-rainbow)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="9" fill={CREAM} stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="none" stroke={INK} strokeWidth="1.2" />
      <text x="50" y="70" textAnchor="middle" fontFamily="cursive" fontSize="8" fill={INK} transform="rotate(-4 50 70)">
        for you :)
      </text>
    </svg>
  );
}
```

```tsx
// lib/stickers/art/brick-phone.tsx
// Per spec §5 #8: candybar phone, ink/grey body, screen chip reads Snake
// pixels in the reused screen-accent color (second CRT-chip callback).
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, SCREEN_BG, SCREEN_TEXT } from "../palette";

export default function BrickPhone({ className }: { className?: string }) {
  const snakeCells: [number, number][] = [
    [36, 24], [40, 24], [44, 24], [44, 28], [44, 32], [40, 32], [36, 32], [36, 36], [36, 40],
  ];
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M32 10 L68 10 Q74 10 74 16 L74 84 Q74 90 68 90 L32 90 Q26 90 26 84 L26 16 Q26 10 32 10 Z" fill="#5a5a5a" />
      <rect x="32" y="18" width="36" height="26" rx="2" fill={SCREEN_BG} />
      {snakeCells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill={SCREEN_TEXT} />
      ))}
      {/* keypad */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={34 + col * 12}
            y={50 + row * 11}
            width="9"
            height="8"
            rx="1.5"
            fill="#7a7a7a"
            stroke={INK}
            strokeWidth="0.8"
          />
        )),
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Write and run the verification script**

```ts
// lib/stickers/verify-tech-art.tsx (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import Mp3Player from "./art/mp3-player";
import FlipPhone from "./art/flip-phone";
import Digicam from "./art/digicam";
import HairClips from "./art/hair-clips";
import StuddedBelt from "./art/studded-belt";
import PlatformBoot from "./art/platform-boot";
import CdR from "./art/cd-r";
import BrickPhone from "./art/brick-phone";

const components: [string, React.FC<{ className?: string }>][] = [
  ["mp3-player", Mp3Player],
  ["flip-phone", FlipPhone],
  ["digicam", Digicam],
  ["hair-clips", HairClips],
  ["studded-belt", StuddedBelt],
  ["platform-boot", PlatformBoot],
  ["cd-r", CdR],
  ["brick-phone", BrickPhone],
];

for (const [name, Component] of components) {
  const markup = renderToStaticMarkup(<Component className="test" />);
  assert.match(markup, /viewBox="0 0 100 100"/, `${name}: missing 100x100 viewBox`);
  assert.match(markup, /class="test"/, `${name}: className prop not forwarded`);
}

// spot-check the two screen-accent stickers use the reused CRT color and
// nothing else in the set does.
const flipMarkup = renderToStaticMarkup(<FlipPhone />);
assert.match(flipMarkup, /#00ff9d/);
assert.match(flipMarkup, /1 NEW MSG/);

const brickMarkup = renderToStaticMarkup(<BrickPhone />);
assert.match(brickMarkup, /#00ff9d/);

for (const [name, Component] of components) {
  if (name === "flip-phone" || name === "brick-phone") continue;
  const markup = renderToStaticMarkup(<Component />);
  assert.doesNotMatch(markup, /#00ff9d/, `${name}: unexpected screen-accent color outside the phones`);
}

console.log("PASS: tech-object sticker art");
```

Run: `npx tsx lib/stickers/verify-tech-art.tsx`
Expected: prints `PASS: tech-object sticker art`.

- [ ] **Step 3: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm lib/stickers/verify-tech-art.tsx
```

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`. Temporarily swap one placeholder's `Art` in `lib/stickers/registry.ts` for each of the 8 new components in turn (or view them via a scratch page) to confirm they render as recognizable objects at a glance and match the manifest's descriptions. Revert the registry swap afterward — Task 9 is where the real registry gets built.
Expected: each sticker reads as its intended object; die-cut border and ink outline are visible on every main silhouette; colors match the palette table in the spec.

- [ ] **Step 5: Commit**

```bash
git add lib/stickers/art/mp3-player.tsx lib/stickers/art/flip-phone.tsx lib/stickers/art/digicam.tsx lib/stickers/art/hair-clips.tsx lib/stickers/art/studded-belt.tsx lib/stickers/art/platform-boot.tsx lib/stickers/art/cd-r.tsx lib/stickers/art/brick-phone.tsx
git commit -m "Author tech-object sticker art (8): mp3 player, flip phone, digicam, hair clips, studded belt, platform boot, CD-R, brick phone

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 7: Type sticker art (4)

**Files:**
- Create: `lib/stickers/art/so-wrong.tsx`
- Create: `lib/stickers/art/2-good-4-u.tsx`
- Create: `lib/stickers/art/no-signal.tsx`
- Create: `lib/stickers/art/whatever.tsx`
- Create: `lib/stickers/verify-type-art.tsx` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: `DieCutShape`, `ChromeGradient`, `STICKER_SVG_STYLE`, `VIEWBOX` (Task 1); `INK`, `PINK`, `SCREEN_BG`, `SCREEN_TEXT` (Task 1)
- Produces: 4 default-exported `React.FC<{ className?: string }>` components. Task 9 imports all 4.

- [ ] **Step 1: Write the 4 Art components**

Per spec §5 #9-12: lettering is drawn as artwork (real `<path>`/`<text>` shapes with the die-cut treatment where called for), not an HTML text overlay — the parent `StickerDef.Art` signature is still just an SVG, so "artwork" here means the sticker's own SVG renders the letterforms itself using `<text>` with a bold display font stack, styled per its own manifest entry, which satisfies "own type treatment, not a shared font" (each sticker sets its own font-family/weight/skew rather than sharing one text style across all four).

```tsx
// lib/stickers/art/so-wrong.tsx
// Per spec §5 #9: bubble letters, hot pink fill, ink outline.
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK, INK } from "../palette";

export default function SoWrong({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <text
        x="50"
        y="46"
        textAnchor="middle"
        fontFamily="Arial Rounded MT Bold, Arial, sans-serif"
        fontWeight="900"
        fontSize="20"
        fill={PINK}
        stroke={INK}
        strokeWidth="2.2"
        paintOrder="stroke"
      >
        SO
      </text>
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontFamily="Arial Rounded MT Bold, Arial, sans-serif"
        fontWeight="900"
        fontSize="20"
        fill={PINK}
        stroke={INK}
        strokeWidth="2.2"
        paintOrder="stroke"
      >
        WRONG
      </text>
    </svg>
  );
}
```

```tsx
// lib/stickers/art/2-good-4-u.tsx
// Per spec §5 #10: chrome bevel, arched baseline.
import { ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function TwoGood4U({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="2good4u-chrome" x1="0" y1="0" x2="0" y2="1" />
        <path id="2good4u-arc" d="M10 70 A45 45 0 0 1 90 70" fill="none" />
      </defs>
      <text
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="15"
        fill="url(#2good4u-chrome)"
        stroke={INK}
        strokeWidth="1.6"
        paintOrder="stroke"
      >
        <textPath href="#2good4u-arc" startOffset="50%" textAnchor="middle">
          2 GOOD 4 U
        </textPath>
      </text>
    </svg>
  );
}
```

```tsx
// lib/stickers/art/no-signal.tsx
// Per spec §5 #11: pixel font, screen-accent color on a screen-bg chip
// (third CRT callback, same recipe as the two phone screens).
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { SCREEN_BG, SCREEN_TEXT, INK } from "../palette";

export default function NoSignal({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <rect x="10" y="34" width="80" height="32" rx="2" fill={SCREEN_BG} stroke={INK} strokeWidth="2" />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="700"
        fontSize="11"
        fill={SCREEN_TEXT}
        letterSpacing="1"
      >
        NO
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="700"
        fontSize="11"
        fill={SCREEN_TEXT}
        letterSpacing="1"
      >
        SIGNAL
      </text>
    </svg>
  );
}
```

```tsx
// lib/stickers/art/whatever.tsx
// Per spec §5 #12: lowercase, thin gothic serif, recolored to ink (was
// pure black) — left as one deliberate touch of edge, diary irony rather
// than goth.
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function Whatever({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="300"
        fontStyle="italic"
        fontSize="17"
        fill={INK}
      >
        whatever.
      </text>
    </svg>
  );
}
```

- [ ] **Step 2: Write and run the verification script**

```ts
// lib/stickers/verify-type-art.tsx (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import SoWrong from "./art/so-wrong";
import TwoGood4U from "./art/2-good-4-u";
import NoSignal from "./art/no-signal";
import Whatever from "./art/whatever";

const cases: [string, React.FC, RegExp[]][] = [
  ["so-wrong", SoWrong, [/SO/, /WRONG/, /#ff2d95/]],
  ["2-good-4-u", TwoGood4U, [/2 GOOD 4 U/]],
  ["no-signal", NoSignal, [/NO/, /SIGNAL/, /#00ff9d/, /#2b0a1e/]],
  ["whatever", Whatever, [/whatever\./]],
];

for (const [name, Component, patterns] of cases) {
  const markup = renderToStaticMarkup(<Component />);
  assert.match(markup, /viewBox="0 0 100 100"/, `${name}: missing viewBox`);
  for (const pattern of patterns) {
    assert.match(markup, pattern, `${name}: missing expected content ${pattern}`);
  }
}

console.log("PASS: type sticker art");
```

Run: `npx tsx lib/stickers/verify-type-art.tsx`
Expected: prints `PASS: type sticker art`.

- [ ] **Step 3: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm lib/stickers/verify-type-art.tsx
```

- [ ] **Step 4: Manual visual check**

Same approach as Task 6 Step 4: temporarily preview each in the dev server, then revert.
Expected: each reads clearly at a glance; NO SIGNAL's screen-chip visually matches the two phone screens from Task 6.

- [ ] **Step 5: Commit**

```bash
git add lib/stickers/art/so-wrong.tsx "lib/stickers/art/2-good-4-u.tsx" lib/stickers/art/no-signal.tsx lib/stickers/art/whatever.tsx
git commit -m "Author type sticker art (4): SO WRONG, 2 GOOD 4 U, NO SIGNAL, whatever.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 8: Motif sticker art (10)

**Files:**
- Create: `lib/stickers/art/book-stack.tsx`
- Create: `lib/stickers/art/broken-heart.tsx`
- Create: `lib/stickers/art/cassette-tape.tsx`
- Create: `lib/stickers/art/sunglasses.tsx`
- Create: `lib/stickers/art/vinyl-record.tsx`
- Create: `lib/stickers/art/firefly-jar.tsx`
- Create: `lib/stickers/art/lightning-bolt.tsx`
- Create: `lib/stickers/art/chrome-star.tsx`
- Create: `lib/stickers/art/halftone-patch.tsx`
- Create: `lib/stickers/art/checkerboard.tsx`
- Create: `lib/stickers/verify-motif-art.tsx` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: `DieCutShape`, `ChromeGradient`, `RainbowGradient`, `HalftonePattern`, `CheckerPattern`, `STICKER_SVG_STYLE`, `VIEWBOX` (Task 1); all palette constants (Task 1)
- Produces: 10 default-exported `React.FC<{ className?: string }>` components. Task 9 imports all 10.

- [ ] **Step 1: Write the 10 Art components**

```tsx
// lib/stickers/art/book-stack.tsx
// Per spec §5 #13 (swap, was: black rose): three fanned, dog-eared
// paperbacks, spines in teal/gold/lavender, a ribbon bookmark trailing off
// the sticker edge — rhymes with the mp3 player's earbud cord.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, TEAL, GOLD, LAVENDER, CREAM } from "../palette";

export default function BookStack({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      {/* bookmark ribbon, bleeding off the bottom edge */}
      <path d="M46 78 L50 106 L54 78" fill={GOLD} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <DieCutShape d="M18 70 L82 70 L82 82 L18 82 Z" fill={LAVENDER} fillRule="evenodd" />
      <DieCutShape
        d="M22 46 L78 40 L80 62 L24 68 Z"
        fill={GOLD}
      />
      <DieCutShape d="M24 20 L70 16 L74 54 L28 58 Z" fill={TEAL} />
      {/* page edges */}
      <rect x="26" y="21" width="4" height="34" fill={CREAM} opacity="0.8" />
      <rect x="20" y="47" width="4" height="19" fill={CREAM} opacity="0.8" />
      <rect x="20" y="71" width="4" height="10" fill={CREAM} opacity="0.8" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/broken-heart.tsx
// Per spec §5 #14: split down the middle, hot pink / cream (was pink/black).
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK, CREAM, INK } from "../palette";

export default function BrokenHeart({ className }: { className?: string }) {
  const leftHalf =
    "M50 88 C 20 66, 10 46, 10 32 C 10 18, 24 12, 34 20 C 40 25, 46 33, 50 40 Z";
  const rightHalf =
    "M50 88 C 80 66, 90 46, 90 32 C 90 18, 76 12, 66 20 C 60 25, 54 33, 50 40 Z";
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d={`${leftHalf} Z`} fill={PINK} />
      <DieCutShape d={`${rightHalf} Z`} fill={CREAM} />
      {/* the crack down the middle */}
      <path d="M50 40 L46 52 L53 60 L47 70 L50 88" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/cassette-tape.tsx
// Per spec §5 #15 (swap, was: barbed wire): a cassette with the tape
// ribbon spilling out in the same diagonal arc the barbed wire had.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, TEAL, SILVER, CREAM } from "../palette";

export default function CassetteTape({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      {/* unspooled ribbon, drawn first, arcing across the sticker */}
      <path
        d="M16 20 Q 50 10, 60 34 Q 68 54, 40 62 Q 20 68, 30 84"
        fill="none"
        stroke="#5a4636"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <DieCutShape d="M22 34 L78 34 Q84 34 84 40 L84 78 Q84 84 78 84 L22 84 Q16 84 16 78 L16 40 Q16 34 22 34 Z" fill={TEAL} />
      <rect x="30" y="44" width="40" height="18" rx="2" fill={CREAM} stroke={INK} strokeWidth="1.2" />
      <circle cx="40" cy="53" r="6" fill="none" stroke={INK} strokeWidth="1.4" />
      <circle cx="60" cy="53" r="6" fill="none" stroke={INK} strokeWidth="1.4" />
      <circle cx="40" cy="53" r="2" fill={SILVER} />
      <circle cx="60" cy="53" r="2" fill={SILVER} />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/sunglasses.tsx
// Per spec §5 #16 (swap, was: skull + bow): cat-eye sunglasses, cream
// frames, lightly tinted lenses, a small hot-pink bow charm on the hinge.
// (No heart-shaped lenses — per your note, plain cat-eye shape.)
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { CREAM, PINK, INK, TEAL_SOFT } from "../palette";

export default function Sunglasses({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape
        d="M10 46 Q10 34 24 34 L40 34 Q48 34 48 44 L48 56 Q48 64 38 64 L20 64 Q10 64 10 54 Z"
        fill={CREAM}
      />
      <DieCutShape
        d="M52 44 L52 56 Q52 64 62 64 L80 64 Q90 64 90 54 L90 46 Q90 34 76 34 L60 34 Q52 34 52 44 Z"
        fill={CREAM}
      />
      <ellipse cx="29" cy="49" rx="14" ry="11" fill={TEAL_SOFT} opacity="0.65" />
      <ellipse cx="71" cy="49" rx="14" ry="11" fill={TEAL_SOFT} opacity="0.65" />
      <path d="M48 46 L52 46" stroke={INK} strokeWidth="3" />
      <path d="M10 46 L2 42" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M90 46 L98 42" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {/* bow charm on the right hinge */}
      <path
        d="M92 40 L98 36 L98 44 Z M92 40 L98 44 L98 36 Z M90 40 L96 40"
        fill={PINK}
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="92" cy="40" r="2" fill={PINK} stroke={INK} strokeWidth="0.8" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/vinyl-record.tsx
// Per spec §5 #17 (swap, was: eyeliner eye): chrome center label, a thin
// rainbow light-streak (same 5-color family as the CD-R) across the disc.
import { DieCutShape, RainbowGradient, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM } from "../palette";

export default function VinylRecord({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <RainbowGradient id="vinyl-streak" />
        <ChromeGradient id="vinyl-label-chrome" />
      </defs>
      <DieCutShape d="M50 8 A42 42 0 1 1 49.9 8 Z" fill={INK} fillRule="evenodd" />
      {[16, 22, 28, 34].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#4a3a3f" strokeWidth="0.6" />
      ))}
      <path
        d="M50 8 A42 42 0 0 1 88 62"
        fill="none"
        stroke="url(#vinyl-streak)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="50" cy="50" r="12" fill="url(#vinyl-label-chrome)" stroke={INK} strokeWidth="1.4" />
      <circle cx="50" cy="50" r="2.2" fill={CREAM} />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/firefly-jar.tsx
// Per spec §5 #18 (swap, was: moth): small glass jar, warm gold glow,
// faint wings.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, GOLD, GOLD_SOFT, SILVER, CREAM } from "../palette";

export default function FireflyJar({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <radialGradient id="firefly-glow" cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor={GOLD_SOFT} stopOpacity="0.9" />
          <stop offset="1" stopColor={GOLD_SOFT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="58" r="30" fill="url(#firefly-glow)" />
      <DieCutShape
        d="M28 40 Q26 34 34 32 L66 32 Q74 34 72 40 L72 78 Q72 86 62 86 L38 86 Q28 86 28 78 Z"
        fill={CREAM}
      />
      <rect x="36" y="20" width="28" height="14" rx="4" fill={SILVER} stroke={INK} strokeWidth="1.4" />
      <circle cx="50" cy="58" r="4" fill={GOLD} />
      <path d="M50 58 L44 52 M50 58 L57 51" stroke={GOLD} strokeWidth="1" opacity="0.7" strokeLinecap="round" />
      <circle cx="40" cy="68" r="2.6" fill={GOLD} opacity="0.85" />
      <circle cx="60" cy="46" r="2.2" fill={GOLD} opacity="0.75" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/lightning-bolt.tsx
// Per spec §5 #19: gold fill (was acid yellow — gold was already
// in-palette), ink outline.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { GOLD } from "../palette";

export default function LightningBolt({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M58 8 L26 54 L46 54 L38 92 L76 42 L54 42 Z" fill={GOLD} />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/chrome-star.tsx
// Per spec §5 #20: four-point star, hard drop shadow, chrome. Unchanged.
import { DieCutShape, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function ChromeStar({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="star-chrome" />
      </defs>
      {/* baked offset "shadow" copy, per spec §7.8 (no CSS filter) */}
      <path d="M50 14 L60 44 L90 50 L60 56 L50 86 L40 56 L10 50 L40 44 Z" fill={INK} opacity="0.35" transform="translate(4,5)" />
      <DieCutShape d="M50 10 L61 42 L94 50 L61 58 L50 90 L39 58 L6 50 L39 42 Z" fill="url(#star-chrome)" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/halftone-patch.tsx
// Per spec §5 #21: pure texture, dot gradient fading hot pink -> cream
// (was pink -> black).
import { HalftonePattern, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK, CREAM } from "../palette";

export default function HalftonePatch({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <HalftonePattern id="halftone-dots" color={PINK} />
        <linearGradient id="halftone-fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PINK} stopOpacity="0" />
          <stop offset="1" stopColor={CREAM} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-dots)" stroke="#fff" strokeWidth="9" strokeLinejoin="round" />
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-dots)" />
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-fade)" />
    </svg>
  );
}
```

```tsx
// lib/stickers/art/checkerboard.tsx
// Per spec §5 #22: warped strip, recolored to match the panel's own
// checker recipe — a swatch of the background peeled up as its own sticker.
import { CheckerPattern, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function Checkerboard({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <CheckerPattern id="checkerboard-sticker" />
      </defs>
      <path
        d="M8 40 Q30 24 50 36 Q70 48 92 32 L92 62 Q70 78 50 66 Q30 54 8 70 Z"
        fill="url(#checkerboard-sticker)"
        stroke="#fff"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path
        d="M8 40 Q30 24 50 36 Q70 48 92 32 L92 62 Q70 78 50 66 Q30 54 8 70 Z"
        fill="url(#checkerboard-sticker)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Write and run the verification script**

```ts
// lib/stickers/verify-motif-art.tsx (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import BookStack from "./art/book-stack";
import BrokenHeart from "./art/broken-heart";
import CassetteTape from "./art/cassette-tape";
import Sunglasses from "./art/sunglasses";
import VinylRecord from "./art/vinyl-record";
import FireflyJar from "./art/firefly-jar";
import LightningBolt from "./art/lightning-bolt";
import ChromeStar from "./art/chrome-star";
import HalftonePatch from "./art/halftone-patch";
import Checkerboard from "./art/checkerboard";

const components: [string, React.FC][] = [
  ["book-stack", BookStack],
  ["broken-heart", BrokenHeart],
  ["cassette-tape", CassetteTape],
  ["sunglasses", Sunglasses],
  ["vinyl-record", VinylRecord],
  ["firefly-jar", FireflyJar],
  ["lightning-bolt", LightningBolt],
  ["chrome-star", ChromeStar],
  ["halftone-patch", HalftonePatch],
  ["checkerboard", Checkerboard],
];

for (const [name, Component] of components) {
  const markup = renderToStaticMarkup(<Component />);
  assert.match(markup, /viewBox="0 0 100 100"/, `${name}: missing viewBox`);
}

// sunglasses must not contain a heart-shaped lens path — confirms the
// no-heart-lenses correction stuck.
const sunglassesMarkup = renderToStaticMarkup(<Sunglasses />);
assert.doesNotMatch(sunglassesMarkup, /heart/i);

// vinyl record and CD-R (Task 6) both use the rainbow family — spot-check
// vinyl has at least the pink and teal bands.
const vinylMarkup = renderToStaticMarkup(<VinylRecord />);
assert.match(vinylMarkup, /#ff2d95/);
assert.match(vinylMarkup, /#009a9a/);

console.log("PASS: motif sticker art");
```

Run: `npx tsx lib/stickers/verify-motif-art.tsx`
Expected: prints `PASS: motif sticker art`.

- [ ] **Step 3: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm lib/stickers/verify-motif-art.tsx
```

- [ ] **Step 4: Manual visual check**

Same approach as Tasks 6 and 7.
Expected: each of the 10 reads clearly; the sunglasses have plain (not heart-shaped) tinted lenses; the vinyl record and CD-R visually rhyme (both chrome-centered discs with a rainbow arc/streak) without looking identical.

- [ ] **Step 5: Commit**

```bash
git add lib/stickers/art/book-stack.tsx lib/stickers/art/broken-heart.tsx lib/stickers/art/cassette-tape.tsx lib/stickers/art/sunglasses.tsx lib/stickers/art/vinyl-record.tsx lib/stickers/art/firefly-jar.tsx lib/stickers/art/lightning-bolt.tsx lib/stickers/art/chrome-star.tsx lib/stickers/art/halftone-patch.tsx lib/stickers/art/checkerboard.tsx
git commit -m "Author motif sticker art (10): book stack, broken heart, cassette tape, sunglasses, vinyl record, firefly jar, lightning bolt, chrome star, halftone patch, checkerboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 9: Full 22-sticker registry

**Files:**
- Modify: `lib/stickers/registry.ts`
- Delete: `lib/stickers/art/placeholder-a.tsx`, `lib/stickers/art/placeholder-b.tsx`, `lib/stickers/art/placeholder-c.tsx`
- Create: `lib/stickers/verify-full-registry.ts` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: all 22 Art components from Tasks 6, 7, 8.
- Produces: `STICKERS: StickerDef[]` with 22 entries (same `StickerDef` shape from Task 2 — no type changes, only data).

- [ ] **Step 1: Replace the registry contents**

Positions follow the composition guidance in spec §6: a clear zone (roughly x 4–40%, under the title/CTA/countdown block) gets only small, edge-anchored stickers; the dense zone (roughly x 42–96%) carries the bulk of the pile with 4–6 deliberate overlaps; edge-bleed pieces (mp3 cord, belt, book stack's ribbon) sit near the panel's outer edges.

```ts
// lib/stickers/registry.ts
import type { FC } from "react";
import Mp3Player from "./art/mp3-player";
import FlipPhone from "./art/flip-phone";
import Digicam from "./art/digicam";
import HairClips from "./art/hair-clips";
import StuddedBelt from "./art/studded-belt";
import PlatformBoot from "./art/platform-boot";
import CdR from "./art/cd-r";
import BrickPhone from "./art/brick-phone";
import SoWrong from "./art/so-wrong";
import TwoGood4U from "./art/2-good-4-u";
import NoSignal from "./art/no-signal";
import Whatever from "./art/whatever";
import BookStack from "./art/book-stack";
import BrokenHeart from "./art/broken-heart";
import CassetteTape from "./art/cassette-tape";
import Sunglasses from "./art/sunglasses";
import VinylRecord from "./art/vinyl-record";
import FireflyJar from "./art/firefly-jar";
import LightningBolt from "./art/lightning-bolt";
import ChromeStar from "./art/chrome-star";
import HalftonePatch from "./art/halftone-patch";
import Checkerboard from "./art/checkerboard";

export type StickerId = string;

export interface StickerDef {
  id: StickerId;
  Art: FC<{ className?: string }>;
  size: number;
  home: { x: number; y: number };
  rotation: number;
  layer: number;
  drift: { amplitude: number; duration: number; delay: number };
}

// See docs/superpowers/specs/2026-09-11-y2k-sticker-header-design.md §5 for
// each sticker's design rationale and §6 for the composition strategy this
// layout follows. home/rotation/layer/drift are hand-authored, hardcoded
// literals — never computed at render time (spec §7.1).
export const STICKERS: StickerDef[] = [
  // --- clear zone: small, edge-anchored, nothing crosses the text baseline ---
  { id: "lightning-bolt", Art: LightningBolt, size: 52, home: { x: 8, y: 14 }, rotation: 9, layer: 1, drift: { amplitude: 3, duration: 7, delay: 0.4 } },
  { id: "chrome-star", Art: ChromeStar, size: 48, home: { x: 6, y: 88 }, rotation: -6, layer: 2, drift: { amplitude: 3, duration: 11, delay: 2.1 } },
  { id: "whatever", Art: Whatever, size: 62, home: { x: 30, y: 92 }, rotation: 4, layer: 3, drift: { amplitude: 3, duration: 9, delay: 3.8 } },

  // --- dense zone: hero-scale pieces (110-130px) ---
  { id: "cd-r", Art: CdR, size: 128, home: { x: 62, y: 30 }, rotation: -10, layer: 10, drift: { amplitude: 6, duration: 11, delay: 0 } },
  { id: "vinyl-record", Art: VinylRecord, size: 118, home: { x: 88, y: 62 }, rotation: 14, layer: 9, drift: { amplitude: 6, duration: 13, delay: 1.9 } },
  { id: "mp3-player", Art: Mp3Player, size: 122, home: { x: 47, y: 68 }, rotation: -6, layer: 12, drift: { amplitude: 5, duration: 9, delay: 4.6 } },
  { id: "book-stack", Art: BookStack, size: 112, home: { x: 75, y: 88 }, rotation: 8, layer: 8, drift: { amplitude: 5, duration: 14, delay: 2.6 } },

  // --- dense zone: mid-size (70-100px) ---
  { id: "flip-phone", Art: FlipPhone, size: 92, home: { x: 55, y: 18 }, rotation: 12, layer: 6, drift: { amplitude: 5, duration: 10, delay: 5.3 } },
  { id: "brick-phone", Art: BrickPhone, size: 88, home: { x: 92, y: 22 }, rotation: -15, layer: 7, drift: { amplitude: 4, duration: 12, delay: 0.9 } },
  { id: "digicam", Art: Digicam, size: 96, home: { x: 66, y: 55 }, rotation: 5, layer: 11, drift: { amplitude: 5, duration: 8, delay: 6.7 } },
  { id: "platform-boot", Art: PlatformBoot, size: 90, home: { x: 40, y: 40 }, rotation: -9, layer: 5, drift: { amplitude: 4, duration: 13, delay: 3.3 } },
  { id: "sunglasses", Art: Sunglasses, size: 80, home: { x: 82, y: 42 }, rotation: 7, layer: 13, drift: { amplitude: 4, duration: 9, delay: 7.9 } },
  { id: "firefly-jar", Art: FireflyJar, size: 76, home: { x: 60, y: 92 }, rotation: -4, layer: 4, drift: { amplitude: 4, duration: 11, delay: 1.2 } },
  { id: "studded-belt", Art: StuddedBelt, size: 100, home: { x: 50, y: 90 }, rotation: 3, layer: 3, drift: { amplitude: 3, duration: 13, delay: 5.9 } },
  { id: "cassette-tape", Art: CassetteTape, size: 84, home: { x: 24, y: 62 }, rotation: -11, layer: 6, drift: { amplitude: 4, duration: 10, delay: 8.4 } },

  // --- dense zone: small filler (48-70px), some overlapping the hero pieces ---
  { id: "hair-clips", Art: HairClips, size: 58, home: { x: 60, y: 22 }, rotation: 16, layer: 14, drift: { amplitude: 3, duration: 8, delay: 4.1 } },
  { id: "broken-heart", Art: BrokenHeart, size: 64, home: { x: 90, y: 82 }, rotation: -8, layer: 15, drift: { amplitude: 3, duration: 12, delay: 6.2 } },
  { id: "halftone-patch", Art: HalftonePatch, size: 56, home: { x: 70, y: 74 }, rotation: 18, layer: 2, drift: { amplitude: 3, duration: 9, delay: 9.1 } },
  { id: "checkerboard", Art: Checkerboard, size: 54, home: { x: 36, y: 78 }, rotation: -13, layer: 1, drift: { amplitude: 3, duration: 11, delay: 2.9 } },
  { id: "so-wrong", Art: SoWrong, size: 66, home: { x: 84, y: 12 }, rotation: -5, layer: 16, drift: { amplitude: 3, duration: 8, delay: 7.4 } },
  { id: "2-good-4-u", Art: TwoGood4U, size: 68, home: { x: 30, y: 50 }, rotation: 6, layer: 4, drift: { amplitude: 3, duration: 10, delay: 3.5 } },
  { id: "no-signal", Art: NoSignal, size: 60, home: { x: 96, y: 48 }, rotation: -7, layer: 5, drift: { amplitude: 3, duration: 12, delay: 1.6 } },
];
```

- [ ] **Step 2: Delete the placeholder Art files**

```bash
rm lib/stickers/art/placeholder-a.tsx lib/stickers/art/placeholder-b.tsx lib/stickers/art/placeholder-c.tsx
```

- [ ] **Step 3: Write and run the verification script**

```ts
// lib/stickers/verify-full-registry.ts (throwaway — deleted after this step)
import assert from "node:assert/strict";
import { STICKERS } from "./registry";

assert.equal(STICKERS.length, 22, `expected 22 stickers, got ${STICKERS.length}`);
const ids = STICKERS.map((s) => s.id);
assert.equal(new Set(ids).size, 22, "sticker ids must be unique");

for (const s of STICKERS) {
  assert.ok(s.size >= 48 && s.size <= 130, `${s.id} size ${s.size} out of range`);
  assert.ok(s.rotation >= -18 && s.rotation <= 18, `${s.id} rotation ${s.rotation} out of range`);
  assert.ok(s.home.x >= 0 && s.home.x <= 100 && s.home.y >= 0 && s.home.y <= 100, `${s.id} home out of range`);
  assert.ok(s.drift.duration >= 6 && s.drift.duration <= 14, `${s.id} drift duration out of 6-14s range`);
  assert.ok(s.drift.amplitude >= 3 && s.drift.amplitude <= 8, `${s.id} drift amplitude out of 3-8px range`);
}

// scale variety: at least one sticker in each of the three tiers from spec §6.
assert.ok(STICKERS.some((s) => s.size >= 110), "missing a hero-scale (110-130px) sticker");
assert.ok(STICKERS.some((s) => s.size >= 70 && s.size < 110), "missing a mid-size (70-100px) sticker");
assert.ok(STICKERS.some((s) => s.size < 70), "missing a small filler (48-70px) sticker");

console.log("PASS: full 22-sticker registry");
```

Run: `npx tsx lib/stickers/verify-full-registry.ts`
Expected: prints `PASS: full 22-sticker registry`.

- [ ] **Step 4: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm lib/stickers/verify-full-registry.ts
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`.
Expected:
- All 22 stickers render in the hero panel, each individually draggable and drifting on its own timing.
- Nothing sits dead-center under the "HAPPY BIRTHDAY AUDREY" title; the title, CTA buttons, and countdown remain fully legible and clickable.
- The pile reads as a pile — overlaps are visible (e.g. hair clips over the CD-R's corner, halftone patch near the boot) without anything looking accidentally buried.
- Performance still feels smooth dragging any sticker with 22 in the DOM (a closer perf pass is Task 11).

- [ ] **Step 6: Commit**

```bash
git add lib/stickers/registry.ts
git rm lib/stickers/art/placeholder-a.tsx lib/stickers/art/placeholder-b.tsx lib/stickers/art/placeholder-c.tsx
git commit -m "Assemble the full 22-sticker registry, remove placeholders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 10: Persistence + shake-it-up control

**Files:**
- Modify: `hooks/useStickerDrag.ts`
- Modify: `components/stickers/StickerField.tsx`
- Create: `hooks/verify-persistence.ts` (throwaway, deleted at the end of this task's step 3)

**Interfaces:**
- Consumes: `STICKERS` (Task 9); `clampTranslate` (Task 4).
- Produces: `loadStickerPositions(): Record<string, { x: number; y: number }>` and `saveStickerPositions(positions: Record<string, { x: number; y: number }>): void` (exported from `hooks/useStickerDrag.ts`); `useStickerDrag`'s return type gains `resetAll: () => void` and `getPosition: (id: string) => { x: number; y: number } | undefined`.

- [ ] **Step 1: Add persistence functions and wire them into `useStickerDrag`**

```ts
// hooks/useStickerDrag.ts — add near the top, after imports:
const STORAGE_KEY = "y2k:sticker-positions";

export function loadStickerPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, { x: number; y: number }>;
  } catch {
    return {};
  }
}

export function saveStickerPositions(positions: Record<string, { x: number; y: number }>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Storage full or disabled — the session still works, it just won't persist.
  }
}
```

Inside `useStickerDrag`, add a debounced save after drag end, and expose `resetAll`/`getPosition`:

```ts
// hooks/useStickerDrag.ts — inside useStickerDrag(), alongside the existing refs:
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const positions: Record<string, { x: number; y: number }> = {};
      translateRef.current.forEach((v, k) => {
        positions[k] = v;
      });
      saveStickerPositions(positions);
    }, 400);
  }, []);
```

Call `scheduleSave()` at the end of `endDrag` (both the mouse/pen branch and the touch branch share the one `endDrag` function already, so one call site covers both):

```ts
      const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        pendingTouchRef.current = null;
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        drag.el.releasePointerCapture(e.pointerId);
        drag.el.style.touchAction = "";
        drag.el.style.willChange = "";
        if (drag.driftEl) drag.driftEl.style.animationPlayState = "running";
        dragRef.current = null;
        scheduleSave();
      };
```

Add `getPosition` and `resetAll` to the hook's return value:

```ts
  const getPosition = useCallback((id: string) => translateRef.current.get(id), []);

  const resetAll = useCallback(() => {
    translateRef.current.clear();
    saveStickerPositions({});
  }, []);

  return { bind, getPosition, resetAll };
```

- [ ] **Step 2: Load saved positions on mount and add the shake-it-up control in `StickerField`**

The shake-it-up button is a real, non-decorative control, so it must not live inside the `aria-hidden="true"` field (per spec §7.7: anything that isn't purely decorative needs a different treatment). It's returned as a sibling of the field via a fragment, both absolutely positioned within `StickerField`'s parent (the hero panel, already `position: relative`):

```tsx
// components/stickers/StickerField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS } from "@/lib/stickers/registry";
import { CheckerPattern } from "@/lib/stickers/shared-defs";
import { useStickerDrag, loadStickerPositions } from "@/hooks/useStickerDrag";

export default function StickerField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bind, resetAll } = useStickerDrag(containerRef);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    // Client-only external system (localStorage) — read post-mount, matching
    // the pattern already used in components/AudreySite.tsx and
    // components/PhotoSlot.tsx, so server and first client render match.
    const saved = loadStickerPositions();
    for (const s of STICKERS) {
      const pos = saved[s.id];
      if (!pos) continue;
      const el = containerRef.current?.querySelector<HTMLDivElement>(`[data-sticker="${s.id}"]`);
      if (el) {
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }
    }
  }, [resetKey]);

  const shakeItUp = () => {
    resetAll();
    if (containerRef.current) {
      containerRef.current.querySelectorAll<HTMLDivElement>("[data-sticker]").forEach((el) => {
        el.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
        el.style.transform = "translate3d(0, 0, 0)";
        setTimeout(() => {
          el.style.transition = "";
        }, 650);
      });
    }
    setResetKey((k) => k + 1);
  };

  return (
    <>
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          // Same stacking-context reasoning as Tasks 3/4: this keeps every
          // sticker's z-index (including promoted drag values) scoped
          // below the content layer's z-index in AudreySite.tsx.
          zIndex: 1,
        }}
      >
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <CheckerPattern id="sticker-field-checker" />
          </defs>
        </svg>
        <div style={{ position: "absolute", inset: 0, background: "url(#sticker-field-checker)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 10% 6%, rgba(125,227,227,0.4), transparent 42%)," +
              "radial-gradient(circle at 92% 3%, rgba(255,95,176,0.34), transparent 40%)," +
              "radial-gradient(circle at 72% 94%, rgba(255,230,128,0.34), transparent 46%)," +
              "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.95) 1.6px, transparent 2.2px)",
            backgroundSize: "100% 100%, 100% 100%, 100% 100%, 24px 24px",
          }}
        />
        {STICKERS.map((s) => (
          <div
            key={s.id}
            data-sticker={s.id}
            {...bind(s.id, s.home.x, s.home.y, s.size)}
            style={{
              position: "absolute",
              left: `${s.home.x}%`,
              top: `${s.home.y}%`,
              width: s.size,
              height: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              zIndex: s.layer,
              pointerEvents: "auto",
            }}
          >
            <div
              data-drift
              className="sticker-drift"
              style={{
                animationDuration: `${s.drift.duration}s`,
                animationDelay: `${s.drift.delay}s`,
                ["--drift-amp" as string]: s.drift.amplitude / 2,
              }}
            >
              <s.Art className="" />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={shakeItUp}
        style={{
          position: "absolute",
          right: 14,
          bottom: 12,
          zIndex: 3,
          pointerEvents: "auto",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#7a0048",
          background: "rgba(255,255,255,0.85)",
          border: "1px solid #f0c9dc",
          borderRadius: 999,
          padding: "7px 14px",
          cursor: "pointer",
        }}
      >
        ↺ shake it up
      </button>
    </>
  );
}
```

- [ ] **Step 3: Write and run the verification script**

```ts
// hooks/verify-persistence.ts (throwaway — deleted after this step)
import assert from "node:assert/strict";

// loadStickerPositions/saveStickerPositions both touch window.localStorage,
// so this script stubs a minimal localStorage rather than importing the
// hook module directly (which also pulls in "use client" React hook code
// not meant to run outside a component).
const store = new Map<string, string>();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: () => null,
    length: 0,
  },
};

const { loadStickerPositions, saveStickerPositions } = await import("./useStickerDrag");

assert.deepEqual(loadStickerPositions(), {}, "empty storage should load as {}");

saveStickerPositions({ "mp3-player": { x: 12, y: -4 } });
assert.deepEqual(loadStickerPositions(), { "mp3-player": { x: 12, y: -4 } });

// corrupt storage falls back to {} rather than throwing
store.set("y2k:sticker-positions", "not json");
assert.deepEqual(loadStickerPositions(), {});

console.log("PASS: sticker position persistence");
```

Run: `npx tsx hooks/verify-persistence.ts`
Expected: prints `PASS: sticker position persistence`.

- [ ] **Step 4: Typecheck, lint, then delete the throwaway script**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
rm hooks/verify-persistence.ts
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`.
Expected:
- Drag a sticker, reload the page: it comes back where you left it (not at its `home` position).
- Click "shake it up": every sticker springs back to its `home` position with a visible bounce, and a reload afterward keeps them at `home` (storage was actually cleared, not just visually reset).
- An unknown id manually added to `localStorage`'s `y2k:sticker-positions` value is ignored without an error (test via DevTools: set the key to `{"nonexistent-id":{"x":5,"y":5}}` and reload).

- [ ] **Step 6: Commit**

```bash
git add hooks/useStickerDrag.ts components/stickers/StickerField.tsx
git commit -m "Add sticker position persistence and shake-it-up control

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```

---

### Task 11: Reduced-motion pass and performance verification

**Files:**
- Modify: `app/globals.css` (verify only — likely no change needed)
- No new files.

**Interfaces:**
- Consumes: everything from Tasks 1-10. This task is verification-only; it produces no new exports.

- [ ] **Step 1: Confirm the reduced-motion rule covers sticker drift**

Read `app/globals.css`'s existing global rule:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

This already applies to `.sticker-drift` (added in Task 5) via the universal selector, and Task 5 additionally added a dedicated `.sticker-drift { animation: none; }` override in the same media query for clarity and belt-and-braces coverage if the universal rule ever narrows. No code change should be needed here — this step is a read-and-confirm, not an edit.

- [ ] **Step 2: Manual reduced-motion verification**

In Chrome DevTools: Cmd+Shift+P → "Rendering" → "Emulate CSS media feature prefers-reduced-motion" → "reduce".
Expected: all 22 stickers stop drifting immediately; dragging still works exactly as before (drag is user-initiated, not an animation, so it's unaffected per spec §7.4).

- [ ] **Step 3: Manual performance verification**

Open Chrome DevTools → Performance panel → record ~5 seconds that includes: page idle with all 22 stickers drifting, then one full drag gesture (pointerdown → move around → pointerup).
Expected, per spec §7.8:
- No layout thrash: the recording's "Layout" and "Recalculate Style" entries during the drift-only portion should be at or near zero — drift animates only `transform`, which the browser handles on the compositor thread.
- During the drag gesture, the dragged element's paints stay cheap (small, sticker-sized rects), not full-page repaints.
- No long tasks (red-flagged entries) attributable to `pointermove` handling — confirms the `requestAnimationFrame` batching in `useStickerDrag` (Task 4) is actually coalescing writes rather than writing on every event.
- The DOM node count for the sticker field is 22 (one per sticker) plus their internal structure — confirms nothing produces duplicate or leaked nodes across the drag/reset/reload cycle exercised in Task 10.

If any of these fail, that's a signal to revisit the specific task above (most likely Task 4's `scheduleWrite` batching or Task 5's animated properties) rather than a new task — record what's found and fix it in place, then re-run this step.

- [ ] **Step 4: Full regression pass**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean build, no type errors, no lint errors. This is the first time `next build` runs against this feature — it catches anything the dev server's incremental compiler let through.

- [ ] **Step 5: Commit** (only if Steps 1-4 required any code changes; otherwise this task ends at Step 4 with nothing to commit)

```bash
git add -A
git commit -m "Verify reduced-motion and performance behavior for the sticker header

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WSHLj3DrU7gb8sYZnGG9uy"
```
