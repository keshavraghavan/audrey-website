// lib/stickers/art/no-signal.tsx
// Per spec §5 #11: pixel font, screen-accent color on a screen-bg chip
// (third CRT callback, same recipe as the two phone screens).
import { STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { SCREEN_BG, SCREEN_TEXT, INK } from "../palette";

export default function NoSignal({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <rect x="10" y="34" width="80" height="32" rx="2" fill="none" stroke="#fff" strokeWidth="9" />
      <rect x="10" y="34" width="80" height="32" rx="2" fill={SCREEN_BG} stroke={INK} strokeWidth="2" />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="700"
        fontSize="11"
        fill={SCREEN_TEXT}
        letterSpacing="1"
      >
        NO
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="700"
        fontSize="11"
        fill={SCREEN_TEXT}
        letterSpacing="1"
      >
        SIGNAL
      </text>
    </svg>
  );
}
