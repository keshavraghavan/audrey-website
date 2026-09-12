import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { TEAL } from "../palette";

export default function PlaceholderB({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M14 14 L86 14 L86 86 L14 86 Z" fill={TEAL} />
    </svg>
  );
}
