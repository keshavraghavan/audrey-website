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
