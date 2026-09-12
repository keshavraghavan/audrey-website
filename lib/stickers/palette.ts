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
