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
