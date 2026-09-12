import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { GOLD } from "../palette";

export default function PlaceholderC({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M50 12 L86 82 L14 82 Z" fill={GOLD} />
    </svg>
  );
}
