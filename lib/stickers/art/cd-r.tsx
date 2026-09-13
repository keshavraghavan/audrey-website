// lib/stickers/art/cd-r.tsx
// Per spec §5 #7: sharpie handwriting on the label, chrome disc, six-hard-
// stop refraction arc using the full site accent family.
import { DieCutShape, ChromeGradient, RainbowGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM } from "../palette";

export default function CdR({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="cdr-chrome" />
        <RainbowGradient id="cdr-rainbow" />
      </defs>
      <DieCutShape d="M50 8 A42 42 0 1 1 49.9 8 Z" fill="url(#cdr-chrome)" fillRule="evenodd" />
      <path
        d="M50 8 A42 42 0 0 1 92 50"
        fill="none"
        stroke="url(#cdr-rainbow)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="9" fill={CREAM} stroke={INK} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="none" stroke={INK} strokeWidth="1.2" />
    </svg>
  );
}
