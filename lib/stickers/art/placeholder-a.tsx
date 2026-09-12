import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { PINK } from "../palette";

export default function PlaceholderA({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M50 10 A40 40 0 1 1 49.9 10 Z" fill={PINK} />
    </svg>
  );
}
