// lib/stickers/art/so-wrong.tsx
// Per spec §5 #9: bubble letters, hot pink fill, ink outline.
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK, INK } from "../palette";

export default function SoWrong({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <text
        x="50"
        y="46"
        textAnchor="middle"
        fontFamily="Arial Rounded MT Bold, Arial, sans-serif"
        fontWeight="900"
        fontSize="20"
        fill={PINK}
        stroke={INK}
        strokeWidth="2.2"
        paintOrder="stroke"
      >
        SO
      </text>
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontFamily="Arial Rounded MT Bold, Arial, sans-serif"
        fontWeight="900"
        fontSize="20"
        fill={PINK}
        stroke={INK}
        strokeWidth="2.2"
        paintOrder="stroke"
      >
        WRONG
      </text>
    </svg>
  );
}
