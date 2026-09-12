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
