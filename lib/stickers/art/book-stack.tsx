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
