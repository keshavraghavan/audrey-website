// lib/stickers/art/digicam.tsx
// Per spec §5 #3: small point-and-shoot, flash-blowout starburst, chrome
// body, grip recolored to ink (was black — same value in spirit).
import { DieCutShape, ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, CREAM, GOLD } from "../palette";

export default function Digicam({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="digicam-chrome" x1="0" y1="0" x2="1" y2="0" />
      </defs>
      {/* flash starburst, behind the body */}
      <path
        d="M74 20 L77 27 L84 24 L79 30 L86 34 L78 34 L80 41 L74 36 L68 41 L70 34 L62 34 L69 30 L64 24 L71 27 Z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <DieCutShape d="M18 34 L76 34 Q82 34 82 40 L82 66 Q82 72 76 72 L18 72 Q12 72 12 66 L12 40 Q12 34 18 34 Z" fill="url(#digicam-chrome)" />
      <rect x="18" y="40" width="14" height="8" rx="2" fill={INK} />
      <circle cx="47" cy="53" r="14" fill={INK} />
      <circle cx="47" cy="53" r="9" fill="#3a3a3a" />
      <circle cx="47" cy="53" r="4" fill="url(#digicam-chrome)" />
      <rect x="66" y="40" width="10" height="6" rx="1.5" fill={CREAM} stroke={INK} strokeWidth="1" />
    </svg>
  );
}
