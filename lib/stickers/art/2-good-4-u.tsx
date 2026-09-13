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
      <text fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="15" fill="none" stroke="#fff" strokeWidth="6">
        <textPath href="#2good4u-arc" startOffset="50%" textAnchor="middle">
          2 GOOD 4 U
        </textPath>
      </text>
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
