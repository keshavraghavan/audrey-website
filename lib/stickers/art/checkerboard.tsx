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
