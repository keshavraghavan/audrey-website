// lib/stickers/art/hair-clips.tsx
// Per spec §5 #4: pair of butterfly clips, one chrome/iridescent, one
// recolored to lavender (was matte black).
import { ChromeGradient, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { LAVENDER, INK } from "../palette";

function ButterflyWings({ cx, cy, fill }: { cx: number; cy: number; fill: string }) {
  return (
    <>
      <path
        d={`M${cx} ${cy} L${cx - 16} ${cy - 10} Q${cx - 22} ${cy - 2} ${cx - 14} ${cy + 4} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx + 16} ${cy - 10} Q${cx + 22} ${cy - 2} ${cx + 14} ${cy + 4} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx - 12} ${cy + 8} Q${cx - 14} ${cy + 14} ${cx - 4} ${cy + 12} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d={`M${cx} ${cy} L${cx + 12} ${cy + 8} Q${cx + 14} ${cy + 14} ${cx + 4} ${cy + 12} L${cx} ${cy} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <ellipse cx={cx} cy={cy} rx="4" ry="3" fill={INK} />
    </>
  );
}

export default function HairClips({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <defs>
        <ChromeGradient id="clip-chrome" />
      </defs>
      <g transform="translate(-6, -4) rotate(-8 36 40)">
        <ButterflyWings cx={36} cy={40} fill="url(#clip-chrome)" />
      </g>
      <g transform="translate(8, 10) rotate(12 66 62)">
        <ButterflyWings cx={66} cy={62} fill={LAVENDER} />
      </g>
    </svg>
  );
}
