// lib/stickers/art/sunglasses.tsx
// Per spec §5 #16 (swap, was: skull + bow): cat-eye sunglasses, cream
// frames, lightly tinted lenses, a small hot-pink bow charm on the hinge.
// (No heart-shaped lenses — per your note, plain cat-eye shape.)
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { CREAM, PINK, INK, TEAL_SOFT } from "../palette";

export default function Sunglasses({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape
        d="M10 46 Q10 34 24 34 L40 34 Q48 34 48 44 L48 56 Q48 64 38 64 L20 64 Q10 64 10 54 Z"
        fill={CREAM}
      />
      <DieCutShape
        d="M52 44 L52 56 Q52 64 62 64 L80 64 Q90 64 90 54 L90 46 Q90 34 76 34 L60 34 Q52 34 52 44 Z"
        fill={CREAM}
      />
      <ellipse cx="29" cy="49" rx="14" ry="11" fill={TEAL_SOFT} opacity="0.65" />
      <ellipse cx="71" cy="49" rx="14" ry="11" fill={TEAL_SOFT} opacity="0.65" />
      <path d="M48 46 L52 46" stroke={INK} strokeWidth="3" />
      <path d="M10 46 L2 42" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M90 46 L98 42" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      {/* bow charm on the right hinge */}
      <path
        d="M92 40 L98 36 L98 44 Z M92 40 L98 44 L98 36 Z M90 40 L96 40"
        fill={PINK}
        stroke={INK}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="92" cy="40" r="2" fill={PINK} stroke={INK} strokeWidth="0.8" />
    </svg>
  );
}
