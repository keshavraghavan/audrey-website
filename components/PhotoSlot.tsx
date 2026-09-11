"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

// Longest side to keep a dropped photo at — plenty sharp for these tile
// sizes without letting a big camera photo blow past localStorage's quota.
const MAX_DIM = 1400;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/avif"];

function downscaleToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(objectUrl);
      if (!ctx) {
        reject(new Error("could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("could not read that image"));
    };
    img.src = objectUrl;
  });
}

/**
 * A drop-in replacement for the guestbook's photo placeholders. Click to
 * browse or drag a photo onto it; the image is downscaled client-side and
 * persisted to localStorage under its `id`, so it survives a reload on this
 * device. Slots sharing the same `id` (the home preview and the full album
 * use the same ids) stay in sync automatically.
 */
export default function PhotoSlot({
  id,
  placeholder = "drop a photo",
  background = "#f2d2e2",
  radius = 8,
}: {
  id: string;
  placeholder?: string;
  background?: string;
  radius?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = `audreyware24:photo:${id}`;

  useEffect(() => {
    // Sync from localStorage on mount — this is a client-only external
    // system, so it can't be read during SSR/initial render.
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSrc(saved);
    } catch {
      // Storage unavailable (private mode, disabled) — slot just stays empty.
    }
  }, [storageKey]);

  const ingest = async (file: File | null | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setError("Drop a PNG, JPEG, WebP, or AVIF image.");
      return;
    }
    setError(null);
    try {
      const dataUrl = await downscaleToDataUrl(file, MAX_DIM);
      setSrc(dataUrl);
      try {
        window.localStorage.setItem(storageKey, dataUrl);
      } catch {
        // Quota exceeded or storage disabled — the photo still shows for
        // this session even though it won't survive a reload.
      }
    } catch {
      setError("Could not read that image.");
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={src ? "Replace photo" : placeholder}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(false);
        void ingest(e.dataTransfer.files?.[0]);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: radius,
        overflow: "hidden",
        cursor: "pointer",
        background: src ? "#000" : background,
        boxShadow: over ? "inset 0 0 0 2px var(--accent-dark)" : "none",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        hidden
        onChange={(e) => {
          void ingest(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {src ? (
        // User-dropped data URL, already resized client-side — next/image has nothing to optimize here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            textAlign: "center",
            padding: 8,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.4,
            color: "rgba(122,0,72,0.55)",
          }}
        >
          <span style={{ fontSize: 22, opacity: 0.6, lineHeight: 1 }}>+</span>
          <span>{placeholder}</span>
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 6,
            fontSize: 10,
            color: "#b3261e",
            background: "rgba(255,255,255,0.9)",
            borderRadius: 5,
            padding: "3px 5px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
