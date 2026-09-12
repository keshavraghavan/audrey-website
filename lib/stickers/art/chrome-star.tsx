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
