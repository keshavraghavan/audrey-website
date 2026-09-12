// lib/stickers/art/brick-phone.tsx
// Per spec §5 #8: candybar phone, ink/grey body, screen chip reads Snake
// pixels in the reused screen-accent color (second CRT-chip callback).
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { INK, SCREEN_BG, SCREEN_TEXT } from "../palette";

export default function BrickPhone({ className }: { className?: string }) {
  const snakeCells: [number, number][] = [
    [36, 24], [40, 24], [44, 24], [44, 28], [44, 32], [40, 32], [36, 32], [36, 36], [36, 40],
  ];
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M32 10 L68 10 Q74 10 74 16 L74 84 Q74 90 68 90 L32 90 Q26 90 26 84 L26 16 Q26 10 32 10 Z" fill="#5a5a5a" />
      <rect x="32" y="18" width="36" height="26" rx="2" fill={SCREEN_BG} />
      {snakeCells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="4" fill={SCREEN_TEXT} />
      ))}
      {/* keypad */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={34 + col * 12}
            y={50 + row * 11}
            width="9"
            height="8"
            rx="1.5"
            fill="#7a7a7a"
            stroke={INK}
            strokeWidth="0.8"
          />
        )),
      )}
    </svg>
  );
}
