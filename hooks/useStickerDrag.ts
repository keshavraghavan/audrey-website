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
      const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
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

      const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
        const drag = dragRef.current;
        if (!drag || drag.id !== id) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
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
