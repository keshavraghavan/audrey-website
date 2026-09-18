"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Track } from "@/lib/audrey-data";
import type { SpotifySearchResult } from "@/lib/spotify";

const inputStyle = {
  border: "none",
  borderRadius: 999,
  background: "#fbf8f8",
  boxShadow: "inset 0 0 0 1px #bfe6e6",
  padding: "10px 14px",
  fontSize: 12,
  color: "#4a3341",
  width: "100%",
  boxSizing: "border-box" as const,
};

// Carries the route's error code so the notice can tell a problem that will
// clear on its own apart from one that won't. `permanent` failures are config
// problems on our side — telling a visitor to try again just wastes their time.
class SearchFailure extends Error {
  constructor(readonly permanent: boolean) {
    super("search failed");
    this.name = "SearchFailure";
  }
}

async function runSearch(query: string, signal: AbortSignal): Promise<SpotifySearchResult[]> {
  const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new SearchFailure(body?.error === "not_configured" || body?.error === "spotify_auth_rejected");
  }
  return (await res.json()) as SpotifySearchResult[];
}

function SongSearch({
  selectedTrack,
  onSelectTrack,
  onClearSelectedTrack,
}: {
  selectedTrack: SpotifySearchResult | null;
  onSelectTrack: (track: SpotifySearchResult) => void;
  onClearSelectedTrack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setResults([]);
      setSearchError("");
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      runSearch(query, controller.signal)
        .then((data) => {
          setResults(data);
          setSearchError("");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setSearchError(
            err instanceof SearchFailure && err.permanent
              ? "Song search isn't set up right now — everything else on the site still works."
              : "Couldn't search right now — try again in a moment.",
          );
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (selectedTrack) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 999,
          background: "#fbf8f8",
          boxShadow: "inset 0 0 0 1px #bfe6e6",
          padding: "6px 8px 6px 14px",
        }}
      >
        <div style={{ flex: 1, fontSize: 12, color: "#4a3341" }}>
          <strong>{selectedTrack.title}</strong> — {selectedTrack.artist}
        </div>
        <button
          onClick={onClearSelectedTrack}
          aria-label="Clear selected song"
          style={{
            border: "none",
            background: "#e7d3de",
            color: "#7a0048",
            borderRadius: "50%",
            width: 22,
            height: 22,
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search for a song…"
        style={inputStyle}
      />
      {searchError && <div style={{ marginTop: 6, fontSize: 11, color: "#a3005e" }}>{searchError}</div>}
      {results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
            overflow: "hidden",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onSelectTrack(r);
                setQuery("");
                setResults([]);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                border: "none",
                background: "none",
                padding: "8px 12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {r.albumArtUrl ? (
                <Image src={r.albumArtUrl} alt="" width={32} height={32} style={{ borderRadius: 5, flex: "none" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 5, flex: "none", background: "#eef0f0" }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#7a0048",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#8a5875",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.artist}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SoundsTab({
  playlist,
  songBy,
  onSongByChange,
  selectedTrack,
  onSelectTrack,
  onClearSelectedTrack,
  notice,
  onAddSong,
}: {
  playlist: Track[];
  songBy: string;
  onSongByChange: (value: string) => void;
  selectedTrack: SpotifySearchResult | null;
  onSelectTrack: (track: SpotifySearchResult) => void;
  onClearSelectedTrack: () => void;
  notice: string;
  onAddSong: () => void;
}) {
  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <div style={{ maxWidth: 480 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-archivo-black)",
            fontSize: 30,
            color: "#00a3a3",
            letterSpacing: "-0.025em",
          }}
        >
          THE BIRTHDAY MIX
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>Add a song here:</p>
        <div
          style={{
            marginTop: 20,
            borderRadius: 14,
            background: "#fbf7f7",
            boxShadow: "0 3px 0 #cfe9e9, 0 10px 22px rgba(0,92,92,0.1)",
            overflow: "hidden",
          }}
        >
          {playlist.map((t) => (
            <div
              key={t.id}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #eef0f0" }}
            >
              {t.albumArtUrl ? (
                <Image src={t.albumArtUrl} alt="" width={34} height={34} style={{ borderRadius: 7, flex: "none" }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: 7, flex: "none", background: "#eef0f0" }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>{t.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: "#9c6d89", textAlign: "right" }}>
                added by
                <br />
                <span style={{ color: "var(--accent-dark)", fontWeight: 700 }}>{t.addedBy}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: 14, background: "#eff7f7", display: "flex", flexDirection: "column", gap: 9 }}>
            <SongSearch selectedTrack={selectedTrack} onSelectTrack={onSelectTrack} onClearSelectedTrack={onClearSelectedTrack} />
            <input
              value={songBy}
              onChange={(e) => onSongByChange(e.target.value)}
              placeholder="your name"
              style={inputStyle}
            />
            <button
              onClick={onAddSong}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#005c5c",
                background: "linear-gradient(#e3f4f4, #7de3e3)",
                border: "none",
                borderRadius: 999,
                padding: 12,
                boxShadow: "inset 0 2px 0 #fff, 0 3px 0 #005c5c",
                cursor: "pointer",
              }}
            >
              Add to the mix
            </button>
            {notice && <div style={{ fontSize: 10, fontWeight: 700, color: "#00807f", minHeight: 13 }}>{notice}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
