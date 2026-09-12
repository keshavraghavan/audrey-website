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
 * smooth-looking gradient besides the rainbow arc/streak, and even this one
 * uses a hard band rather than a soft blend). */
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
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      <stop offset="0" stopColor="#8a8a8a" />
      <stop offset="0.32" stopColor="#f2f2f2" />
      <stop offset="0.5" stopColor="#ffffff" />
      <stop offset="0.68" stopColor="#f2f2f2" />
      <stop offset="1" stopColor="#8a8a8a" />
    </linearGradient>
  );
}

/** Six-hard-stop refraction arc using the site's own accent family, per
 * spec §5 (#7 CD-R) and §5 (#17 vinyl record) — paired stops at nearly the
 * same offset create a hard edge between bands instead of a blend. */
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
  const bands: [number, string][] = [
    [0, PINK],
    [0.2, TEAL],
    [0.4, GOLD],
    [0.6, LAVENDER],
    [0.8, RUST],
    [1, PINK],
  ];
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {bands.map(([offset, color], i) => (
        <stop key={i} offset={offset} stopColor={color} />
      ))}
      {bands.slice(0, -1).map(([offset], i) => (
        <stop key={`hard-${i}`} offset={Math.min(offset + 0.001, 1)} stopColor={bands[i + 1][1]} />
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
