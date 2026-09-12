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
