// components/stickers/StickerField.tsx
"use client";

import { useRef } from "react";
import { STICKERS } from "@/lib/stickers/registry";
import { CheckerPattern } from "@/lib/stickers/shared-defs";
import { useStickerDrag } from "@/hooks/useStickerDrag";

export default function StickerField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bind } = useStickerDrag(containerRef);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        // Explicit z-index (not just non-static position) is what makes
        // this a stacking context of its own — without it, a sticker's
        // internal z-index (up to ~1000+ once promoted by drag, see Task
        // 4) would compare directly against the content layer's z-index
        // in AudreySite.tsx and could render above the title. With it,
        // every descendant's z-index is scoped inside this "1" and can
        // never escape above a sibling layer with a higher z-index (per
        // spec §7.6 — content must stay above stickers even mid-drag).
        zIndex: 1,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <CheckerPattern id="sticker-field-checker" />
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "url(#sticker-field-checker)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 10% 6%, rgba(125,227,227,0.4), transparent 42%)," +
            "radial-gradient(circle at 92% 3%, rgba(255,95,176,0.34), transparent 40%)," +
            "radial-gradient(circle at 72% 94%, rgba(255,230,128,0.34), transparent 46%)," +
            "radial-gradient(circle at 3px 3px, rgba(255,255,255,0.95) 1.6px, transparent 2.2px)",
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 24px 24px",
        }}
      />
      {STICKERS.map((s) => (
        <div
          key={s.id}
          data-sticker={s.id}
          {...bind(s.id, s.home.x, s.home.y, s.size)}
          style={{
            position: "absolute",
            left: `${s.home.x}%`,
            top: `${s.home.y}%`,
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            zIndex: s.layer,
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          <div data-drift style={{ width: "100%", height: "100%" }}>
            <s.Art className="" />
          </div>
        </div>
      ))}
    </div>
  );
}
