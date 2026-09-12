// hooks/useStickerDrag.ts
"use client";

import { useCallback, useRef } from "react";

/**
 * Clamps a proposed drag translate (dx, dy, relative to the sticker's home
 * position) so at least 60% of the sticker stays inside the container.
 * Pure and side-effect-free so it's independently testable — see
 * hooks/verify-clamp.ts.
 */
export function clampTranslate(
  dx: number,
  dy: number,
  size: number,
  containerWidth: number,
  containerHeight: number,
  homeXPct: number,
  homeYPct: number,
): { x: number; y: number } {
  const homeX = (homeXPct / 100) * containerWidth;
  const homeY = (homeYPct / 100) * containerHeight;
  const visible = size * 0.6; // at least 60% of the sticker must stay inside
  const minX = -homeX - size / 2 + visible;
  const maxX = containerWidth - homeX - size / 2 - visible + size;
  const minY = -homeY - size / 2 + visible;
  const maxY = containerHeight - homeY - size / 2 - visible + size;
  return {
    x: Math.min(Math.max(dx, minX), maxX),
    y: Math.min(Math.max(dy, minY), maxY),
  };
}

let topZ = 1000;

export function useStickerDrag(containerRef: React.RefObject<HTMLElement | null>) {
  // One ref per sticker id, holding its live translate — read/written
  // outside React state so pointermove never triggers a re-render.
  const translateRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    id: string;
    el: HTMLDivElement;
    driftEl: HTMLElement | null;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    size: number;
    homeXPct: number;
    homeYPct: number;
  } | null>(null);
  // Declared here (not as a local inside bind()) for the same reason as
  // dragRef: bind(id, ...) runs its body fresh on every call, and
  // StickerField calls bind() again for every sticker on every one of its
  // own re-renders (state changes elsewhere in AudreySite.tsx, not just
  // drag activity, can trigger this). A ref declared inside bind()'s
  // closure would reset to null on any such re-render, silently dropping
  // a touch gesture that was mid-threshold-check. One shared ref, tagged
  // with which sticker it belongs to (mirroring dragRef's own `id`
  // field), survives across renders like dragRef does.
  const pendingTouchRef = useRef<null | { id: string; startX: number; startY: number; startT: number; el: HTMLDivElement }>(null);

  const applyTransform = useCallback((el: HTMLDivElement, x: number, y: number, z: number) => {
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.zIndex = String(z);
  }, []);

  const scheduleWrite = useCallback((el: HTMLDivElement, x: number, y: number, z: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyTransform(el, x, y, z);
      rafRef.current = null;
    });
  }, [applyTransform]);

  const bind = useCallback(
    (id: string, homeXPct: number, homeYPct: number, size: number) => {
      const claimDrag = (el: HTMLDivElement, e: React.PointerEvent<HTMLDivElement>) => {
        el.setPointerCapture(e.pointerId);
        el.style.touchAction = "none";
        const current = translateRef.current.get(id) ?? { x: 0, y: 0 };
        const driftEl = el.querySelector<HTMLElement>("[data-drift]");
        if (driftEl) driftEl.style.animationPlayState = "paused";
        el.style.willChange = "transform";
        topZ += 1;
        dragRef.current = {
          id,
          el,
          driftEl,
          startX: e.clientX,
          startY: e.clientY,
          baseX: current.x,
          baseY: current.y,
          size,
          homeXPct,
          homeYPct,
        };
        applyTransform(el, current.x, current.y, topZ);
      };

      const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        if (e.pointerType !== "touch") {
          claimDrag(el, e);
          return;
        }
        // Touch: wait for horizontal intent or a hold before claiming the
        // gesture, so a vertical swipe here still scrolls the page. Tagged
        // with `id` because pendingTouchRef is now one shared ref (see the
        // hook's top-level declaration) rather than a per-sticker local.
        pendingTouchRef.current = { id, startX: e.clientX, startY: e.clientY, startT: performance.now(), el };
      };

      const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const pending = pendingTouchRef.current;
        if (pending && pending.id === id && !dragRef.current) {
          const dx = Math.abs(e.clientX - pending.startX);
          const dy = Math.abs(e.clientY - pending.startY);
          const held = performance.now() - pending.startT > 200;
          if (dx > 8 && dy < 8) {
            claimDrag(pending.el, e);
            pendingTouchRef.current = null;
          } else if (held) {
            claimDrag(pending.el, e);
            pendingTouchRef.current = null;
          } else if (dy >= 8) {
            // Vertical-first — this is a page scroll, not a drag. Stop
            // tracking until the next pointerdown.
            pendingTouchRef.current = null;
            return;
          } else {
            return;
          }
        }
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const rawDx = drag.baseX + (e.clientX - drag.startX);
        const rawDy = drag.baseY + (e.clientY - drag.startY);
        const clamped = clampTranslate(rawDx, rawDy, drag.size, rect.width, rect.height, drag.homeXPct, drag.homeYPct);
        translateRef.current.set(id, clamped);
        scheduleWrite(drag.el, clamped.x, clamped.y, topZ);
      };

      const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        // Only clear a pending touch that actually belongs to this
        // sticker — the shared ref may hold a different sticker's still-
        // pending gesture (same single-slot tradeoff dragRef already has).
        if (pendingTouchRef.current?.id === id) pendingTouchRef.current = null;
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        drag.el.releasePointerCapture(e.pointerId);
        drag.el.style.touchAction = "";
        drag.el.style.willChange = "";
        if (drag.driftEl) drag.driftEl.style.animationPlayState = "running";
        dragRef.current = null;
      };

      return {
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
      };
    },
    [applyTransform, scheduleWrite, containerRef],
  );

  return { bind };
}
