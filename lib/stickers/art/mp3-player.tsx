// lib/stickers/art/mp3-player.tsx
// Per spec §5 #1: click-wheel player, earbud cord trailing off the sticker
// edge, bubblegum pink body, chrome bezel.
import { DieCutShape, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK_SOFT, PINK, CREAM, INK } from "../palette";

export default function Mp3Player({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <linearGradient id="mp3-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PINK_SOFT} />
          <stop offset="1" stopColor={PINK} />
        </linearGradient>
        <ChromeGradient id="mp3-chrome" />
      </defs>
      {/* earbud cord, drawn first so it sits under the body and bleeds off the corner */}
      <path
        d="M38 78 C 30 88, 18 92, -2 102"
        fill="none"
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <DieCutShape d="M34 12 L66 12 Q72 12 72 18 L72 82 Q72 88 66 88 L34 88 Q28 88 28 82 L28 18 Q28 12 34 12 Z" fill="url(#mp3-body)" />
      <rect x="40" y="21" width="20" height="13" rx="2.5" fill="url(#mp3-chrome)" stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="64" r="16" fill="url(#mp3-chrome)" stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="64" r="6" fill={CREAM} stroke={INK} strokeWidth="1.2" />
    </svg>
  );
}
