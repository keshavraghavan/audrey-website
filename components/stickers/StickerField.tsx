// components/stickers/StickerField.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { STICKERS } from "@/lib/stickers/registry";
import { CheckerPattern } from "@/lib/stickers/shared-defs";
import { useStickerDrag, loadStickerPositions } from "@/hooks/useStickerDrag";

export default function StickerField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bind, resetAll } = useStickerDrag(containerRef);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    // Client-only external system (localStorage) — read post-mount, matching
    // the pattern already used in components/AudreySite.tsx and
    // components/PhotoSlot.tsx, so server and first client render match.
    const saved = loadStickerPositions();
    for (const s of STICKERS) {
      const pos = saved[s.id];
      if (!pos) continue;
      const el = containerRef.current?.querySelector<HTMLDivElement>(`[data-sticker="${s.id}"]`);
      if (el) {
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      }
    }
  }, [resetKey]);

  const shakeItUp = () => {
    resetAll();
    if (containerRef.current) {
      containerRef.current.querySelectorAll<HTMLDivElement>("[data-sticker]").forEach((el) => {
        el.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
        el.style.transform = "translate3d(0, 0, 0)";
        setTimeout(() => {
          el.style.transition = "";
        }, 650);
      });
    }
    setResetKey((k) => k + 1);
  };

  return (
    <>
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
            }}
          >
            <div
              data-drift
              className="sticker-drift"
              style={{
                animationDuration: `${s.drift.duration}s`,
                animationDelay: `${s.drift.delay}s`,
                // amplitude scales the keyframes' fixed 1px/0.6deg shape
                ["--drift-amp" as string]: s.drift.amplitude / 2,
              }}
            >
              <s.Art className="" />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={shakeItUp}
        style={{
          position: "absolute",
          right: 14,
          bottom: 12,
          zIndex: 3,
          pointerEvents: "auto",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "#7a0048",
          background: "rgba(255,255,255,0.85)",
          border: "1px solid #f0c9dc",
          borderRadius: 999,
          padding: "7px 14px",
          cursor: "pointer",
        }}
      >
        ↺ shake it up
      </button>
    </>
  );
}
