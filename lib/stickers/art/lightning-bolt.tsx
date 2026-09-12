// lib/stickers/art/lightning-bolt.tsx
// Per spec §5 #19: gold fill (was acid yellow — gold was already
// in-palette), ink outline.
import { DieCutShape, STICKER_SVG_STYLE, VIEWBOX } from "../shared-defs";
import { GOLD } from "../palette";

export default function LightningBolt({ className }: { className?: string }) {
  return (
    <svg viewBox={VIEWBOX} className={className} style={STICKER_SVG_STYLE}>
      <DieCutShape d="M58 8 L26 54 L46 54 L38 92 L76 42 L54 42 Z" fill={GOLD} />
    </svg>
  );
}
