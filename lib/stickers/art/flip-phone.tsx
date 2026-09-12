// lib/stickers/art/flip-phone.tsx
// Per spec §5 #2: open, tiny screen, teal shell (recolored from the
// original brief's pink so it doesn't duplicate the mp3 player), silver
// hinge, screen chip reads "1 NEW MSG" in the reused screen-accent color.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { TEAL_SOFT, TEAL, SILVER, SCREEN_BG, SCREEN_TEXT, INK } from "../palette";

export default function FlipPhone({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <linearGradient id="flip-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={TEAL_SOFT} />
          <stop offset="1" stopColor={TEAL} />
        </linearGradient>
      </defs>
      {/* bottom half (keypad body) */}
      <DieCutShape d="M32 52 L68 52 Q74 52 74 58 L74 88 Q74 92 70 92 L30 92 Q26 92 26 88 L26 58 Q26 52 32 52 Z" fill="url(#flip-shell)" />
      {/* top half (screen body), offset up-left to read as "open" */}
      <DieCutShape d="M28 10 L64 10 Q70 10 70 16 L70 46 Q70 50 66 50 L26 50 Q22 50 22 46 L22 16 Q22 10 28 10 Z" fill="url(#flip-shell)" />
      {/* hinge */}
      <rect x="24" y="49" width="48" height="5" rx="2.5" fill={SILVER} stroke={INK} strokeWidth="1" />
      {/* screen chip */}
      <rect x="30" y="18" width="32" height="24" rx="2" fill={SCREEN_BG} />
      <text x="46" y="33" textAnchor="middle" fontFamily="monospace" fontSize="7" fill={SCREEN_TEXT}>
        1 NEW MSG
      </text>
      {/* keypad hint */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={34 + i * 12} y="70" width="8" height="6" rx="1.5" fill={SILVER} opacity="0.85" />
      ))}
    </svg>
  );
}
