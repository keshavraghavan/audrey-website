// lib/stickers/art/studded-belt.tsx
// Per spec §5 #5: fragment running diagonally off both sticker edges, ink
// leather, chrome pyramid studs.
import { ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK } from "../palette";

export default function StuddedBelt({ className }: { className?: string }) {
  const studs = [22, 38, 54, 70, 86];
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="stud-chrome" />
      </defs>
      {/* the strap itself is not die-cut individually inset — it's designed
          to bleed off both edges, per spec §1/§5 */}
      <path d="M-6 74 L106 26 L106 44 L-6 92 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {studs.map((x) => {
        // centerline of the diagonal strap band at this x (the band runs
        // from (-6,74)-(106,26) on top to (-6,92)-(106,44) on the bottom)
        const cy = 83 - ((x + 6) / 112) * 48;
        return (
          <path
            key={x}
            d={`M${x} ${cy - 6} L${x + 6} ${cy} L${x} ${cy + 6} L${x - 6} ${cy} Z`}
            fill="url(#stud-chrome)"
            stroke={INK}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
