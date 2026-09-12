// lib/stickers/art/whatever.tsx
// Per spec §5 #12: lowercase, thin gothic serif, recolored to ink (was
// pure black) — left as one deliberate touch of edge, diary irony rather
// than goth.
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function Whatever({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="300"
        fontStyle="italic"
        fontSize="17"
        fill={INK}
      >
        whatever.
      </text>
    </svg>
  );
}
