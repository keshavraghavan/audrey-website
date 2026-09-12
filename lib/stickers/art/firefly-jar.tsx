// lib/stickers/art/firefly-jar.tsx
// Per spec §5 #18 (swap, was: moth): small glass jar, warm gold glow,
// faint wings.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, GOLD, GOLD_SOFT, SILVER, CREAM } from "../palette";

export default function FireflyJar({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <radialGradient id="firefly-glow" cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor={GOLD_SOFT} stopOpacity="0.9" />
          <stop offset="1" stopColor={GOLD_SOFT} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="58" r="30" fill="url(#firefly-glow)" />
      <DieCutShape
        d="M28 40 Q26 34 34 32 L66 32 Q74 34 72 40 L72 78 Q72 86 62 86 L38 86 Q28 86 28 78 Z"
        fill={CREAM}
      />
      <rect x="36" y="20" width="28" height="14" rx="4" fill={SILVER} stroke={INK} strokeWidth="1.4" />
      <circle cx="50" cy="58" r="4" fill={GOLD} />
      <path d="M50 58 L44 52 M50 58 L57 51" stroke={GOLD} strokeWidth="1" opacity="0.7" strokeLinecap="round" />
      <circle cx="40" cy="68" r="2.6" fill={GOLD} opacity="0.85" />
      <circle cx="60" cy="46" r="2.2" fill={GOLD} opacity="0.75" />
    </svg>
  );
}
