// lib/stickers/art/platform-boot.tsx
// Per spec §5 #6: chunky sole, side profile, ink body, laces recolored to
// teal (was red).
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, TEAL, GOLD } from "../palette";

export default function PlatformBoot({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape
        d="M20 30 L52 30 Q60 30 64 38 L80 58 L86 58 Q92 58 92 66 L92 80 Q92 86 86 86 L18 86 Q12 86 12 80 L12 40 Q12 30 20 30 Z"
        fill={INK}
      />
      {/* sole, a lighter band along the bottom */}
      <path d="M14 78 L90 78 L90 84 Q90 86 88 86 L16 86 Q14 86 14 84 Z" fill="#4a3341" />
      {/* laces */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={30 + i * 8} y1={40 + i * 4} x2={44 + i * 8} y2={36 + i * 4} stroke={TEAL} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      {/* eyelets */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={32 + i * 8} cy={38 + i * 3.5} r="1.6" fill={GOLD} />
      ))}
    </svg>
  );
}
