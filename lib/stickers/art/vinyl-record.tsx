// lib/stickers/art/vinyl-record.tsx
// Per spec §5 #17 (swap, was: eyeliner eye): chrome center label, a thin
// rainbow light-streak (same 5-color family as the CD-R) across the disc.
import { DieCutShape, RainbowGradient, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM } from "../palette";

export default function VinylRecord({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <RainbowGradient id="vinyl-streak" />
        <ChromeGradient id="vinyl-label-chrome" />
      </defs>
      <DieCutShape d="M50 8 A42 42 0 1 1 49.9 8 Z" fill={INK} fillRule="evenodd" />
      {[16, 22, 28, 34].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#4a3a3f" strokeWidth="0.6" />
      ))}
      <path
        d="M50 8 A42 42 0 0 1 88 62"
        fill="none"
        stroke="url(#vinyl-streak)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="50" cy="50" r="12" fill="url(#vinyl-label-chrome)" stroke={INK} strokeWidth="1.4" />
      <circle cx="50" cy="50" r="2.2" fill={CREAM} />
    </svg>
  );
}
