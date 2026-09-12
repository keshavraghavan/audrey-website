// lib/stickers/art/cassette-tape.tsx
// Per spec §5 #15 (swap, was: barbed wire): a cassette with the tape
// ribbon spilling out in the same diagonal arc the barbed wire had.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, TEAL, SILVER, CREAM } from "../palette";

export default function CassetteTape({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      {/* unspooled ribbon, drawn first, arcing across the sticker */}
      <path
        d="M16 20 Q 50 10, 60 34 Q 68 54, 40 62 Q 20 68, 30 84"
        fill="none"
        stroke="#5a4636"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <DieCutShape d="M22 34 L78 34 Q84 34 84 40 L84 78 Q84 84 78 84 L22 84 Q16 84 16 78 L16 40 Q16 34 22 34 Z" fill={TEAL} />
      <rect x="30" y="44" width="40" height="18" rx="2" fill={CREAM} stroke={INK} strokeWidth="1.2" />
      <circle cx="40" cy="53" r="6" fill="none" stroke={INK} strokeWidth="1.4" />
      <circle cx="60" cy="53" r="6" fill="none" stroke={INK} strokeWidth="1.4" />
      <circle cx="40" cy="53" r="2" fill={SILVER} />
      <circle cx="60" cy="53" r="2" fill={SILVER} />
    </svg>
  );
}
