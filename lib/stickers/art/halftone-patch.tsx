// lib/stickers/art/halftone-patch.tsx
// Per spec §5 #21: pure texture, dot gradient fading hot pink -> cream
// (was pink -> black).
import { HalftonePattern, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK, CREAM } from "../palette";

export default function HalftonePatch({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <HalftonePattern id="halftone-dots" color={PINK} />
        <linearGradient id="halftone-fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PINK} stopOpacity="0" />
          <stop offset="1" stopColor={CREAM} stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-dots)" stroke="#fff" strokeWidth="9" strokeLinejoin="round" />
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-dots)" />
      <path d="M10 20 L88 8 L94 74 L18 92 Z" fill="url(#halftone-fade)" />
    </svg>
  );
}
