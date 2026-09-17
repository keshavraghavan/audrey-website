"use client";

import { useCallback, useEffect, useState } from "react";
import HomeTab from "@/components/tabs/HomeTab";
import SoundsTab from "@/components/tabs/SoundsTab";
import PhotosTab from "@/components/tabs/PhotosTab";
import GuestbookTab from "@/components/tabs/GuestbookTab";
import StickerField from "@/components/stickers/StickerField";
import { addTrackToMix } from "@/app/actions";
import type { SpotifySearchResult } from "@/lib/spotify";
import {
  ACCENT,
  AGE,
  BIRTHDAY,
  NAME,
  SEED_MESSAGES,
  TABS,
  type GuestbookMessage,
  type Tab,
  type Track,
} from "@/lib/audrey-data";

const STORAGE_KEY = "audreyware24";
const MARQUEE_TEXT =
  "✿ sign the guestbook ✿ add a song to her playlist ✿ drop a photo in the album ✿ tell us your first memory of her ✿ ";

type SavedState = {
  messages?: GuestbookMessage[];
  liked?: Record<string, boolean>;
};

export default function AudreySite({ initialTracks }: { initialTracks: Track[] }) {
  const [tab, setTab] = useState<Tab>("home");
  const [messages, setMessages] = useState<GuestbookMessage[]>(SEED_MESSAGES);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [playlist, setPlaylist] = useState<Track[]>(initialTracks);
  const [hydrated, setHydrated] = useState(false);

  const [formName, setFormName] = useState("");
  const [formBody, setFormBody] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedTrack, setSelectedTrack] = useState<SpotifySearchResult | null>(null);
  const [songBy, setSongBy] = useState("");
  const [soundsNotice, setSoundsNotice] = useState("");

  const [daysToGo, setDaysToGo] = useState<number | null>(null);

  // Restore anything a visitor on this device already posted. Done in an
  // effect (not the initial state) so server and first client render match —
  // localStorage doesn't exist on the server.
  useEffect(() => {
    // One-time sync from external systems (the clock, localStorage) that
    // don't exist during SSR — this has to run post-mount, not during
    // render, or server and client would disagree on the first paint.
    /* eslint-disable react-hooks/set-state-in-effect */
    document.documentElement.style.setProperty("--accent", ACCENT);
    setDaysToGo(Math.max(0, Math.ceil((BIRTHDAY.getTime() - Date.now()) / 86400000)));
    try {
      const saved: SavedState = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.messages?.length) setMessages(saved.messages);
      if (saved.liked) setLiked(saved.liked);
    } catch {
      // Corrupt or unavailable storage — carry on with the seed content.
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, liked }));
    } catch {
      // Storage full or disabled — the session still works, it just won't persist.
    }
  }, [messages, liked, hydrated]);

  const goTo = useCallback((t: Tab) => setTab(t), []);
  const toggleLike = useCallback((id: string) => setLiked((s) => ({ ...s, [id]: !s[id] })), []);

  const postMessage = useCallback(() => {
    if (!formName.trim() || !formBody.trim()) {
      setNotice("Need a name and a note before we can post it.");
      return;
    }
    const msg: GuestbookMessage = {
      id: "u" + Date.now(),
      name: formName.trim(),
      meta: "just now",
      swatch: "linear-gradient(135deg, #ff8ec9, #d6006e)",
      tint: "pink",
      likes: 0,
      body: formBody.trim(),
    };
    setMessages((m) => [msg, ...m]);
    setFormName("");
    setFormBody("");
    setNotice("Posted — she'll see it on the 20th.");
  }, [formName, formBody]);

  const addSong = useCallback(async () => {
    if (!selectedTrack) {
      setSoundsNotice("Pick a song from the search results first.");
      return;
    }
    const addedBy = songBy.trim() || "anonymous";
    const result = await addTrackToMix({
      spotifyId: selectedTrack.id,
      spotifyUri: selectedTrack.uri,
      title: selectedTrack.title,
      artist: selectedTrack.artist,
      albumArtUrl: selectedTrack.albumArtUrl,
      addedBy,
    });
    if (!result.ok) {
      setSoundsNotice(result.error);
      return;
    }
    if (result.duplicate) {
      setSoundsNotice("Already on the mix!");
      return;
    }
    setPlaylist((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        spotifyId: selectedTrack.id,
        spotifyUri: selectedTrack.uri,
        title: selectedTrack.title,
        artist: selectedTrack.artist,
        albumArtUrl: selectedTrack.albumArtUrl,
        addedBy,
      },
    ]);
    setSelectedTrack(null);
    setSongBy("");
    setSoundsNotice("Added to the mix!");
  }, [selectedTrack, songBy]);

  const nameUpper = NAME.toUpperCase();
  const daysLabel =
    daysToGo === null ? "counting the days…" : daysToGo > 0 ? `${daysToGo} days until she opens this` : "it's today — go tell her";

  return (
    <div style={{ minHeight: "100vh", fontFamily: "Verdana, Geneva, sans-serif", color: "#4a3341" }}>
      <div
        style={{
          background: "linear-gradient(var(--accent-soft), var(--accent-dark))",
          color: "#fff",
          padding: "7px clamp(12px, 3vw, 20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 14px",
          flexWrap: "wrap",
          fontFamily: "var(--font-vt323)",
          fontSize: "clamp(16px, 4vw, 19px)",
          letterSpacing: "0.08em",
        }}
      >
        <span>◆ AUDREYWARE 24.0 — birthday edition</span>
        <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span>SEP·20·2026</span>
          <span
            style={{
              background: "#2b0a1e",
              color: "#00ff9d",
              fontFamily: "var(--font-press-start-2p)",
              fontSize: 11,
              padding: "4px 7px",
              letterSpacing: "0.1em",
            }}
          >
            0 0 4 1 2
          </span>
        </span>
      </div>

      <div style={{ overflow: "hidden", background: "#faf2f5", borderBottom: "2px solid var(--accent)", padding: "5px 0" }}>
        <div
          style={{
            display: "flex",
            width: "200%",
            animation: "cd-marquee 26s linear infinite",
            fontFamily: "var(--font-vt323)",
            fontSize: 19,
            color: "var(--accent-dark)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: "50%" }}>{MARQUEE_TEXT}</span>
          <span style={{ width: "50%" }}>{MARQUEE_TEXT}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px clamp(12px, 4vw, 54px) 56px" }}>
        <div
          style={{
            background: "#faf2f5",
            overflow: "hidden",
            borderRadius: 20,
            border: "2px solid #fff",
            boxShadow: "0 16px 40px rgba(122,0,72,0.20)",
          }}
        >
          <div
            style={{
              background: "#f6ebf1",
              padding: "clamp(28px, 4vw, 44px) clamp(20px, 4vw, 48px) clamp(30px, 4vw, 46px)",
              position: "relative",
            }}
          >
            <StickerField />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0))",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
              <div style={{ maxWidth: "min(520px, 100%)" }}>
                <div style={{ fontFamily: "var(--font-press-start-2p)", fontSize: 11, color: "#a3005e", letterSpacing: "0.05em" }}>
                  {nameUpper} · VERSION {AGE}.0
                </div>
                <h1
                  style={{
                    margin: "16px 0 0",
                    fontFamily: "var(--font-archivo-black)",
                    fontSize: "clamp(38px, 7vw, 72px)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.04em",
                    color: "#a3005e",
                    textShadow: "0 3px 0 rgba(255,255,255,0.7), 0 6px 14px rgba(122,0,72,0.18)",
                  }}
                >
                  HAPPY
                  <br />
                  BIRTHDAY
                  <br />
                  {nameUpper}!
                </h1>
                <div style={{ marginTop: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => goTo("guestbook")}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#a3005e",
                      background: "linear-gradient(#fdf5f8, #f7cfe3)",
                      padding: "14px 28px",
                      border: "none",
                      borderRadius: 999,
                      boxShadow: "inset 0 2px 0 #fff, 0 4px 0 #a3005e",
                      cursor: "pointer",
                    }}
                  >
                    Sign the guestbook
                  </button>
                  <button
                    onClick={() => goTo("sounds")}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#005c5c",
                      background: "linear-gradient(#e3f4f4, #7de3e3)",
                      padding: "14px 28px",
                      border: "none",
                      borderRadius: 999,
                      boxShadow: "inset 0 2px 0 #fff, 0 4px 0 #005c5c",
                      cursor: "pointer",
                    }}
                  >
                    Add a song
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontFamily: "var(--font-vt323)",
                    fontSize: 21,
                    color: "#7a0048",
                    animation: "cd-blink 1.3s steps(1) infinite",
                  }}
                >
                  ◄ NEW ► {daysLabel}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
              padding: "14px clamp(14px, 3vw, 40px)",
              background: "#faf2f5",
              borderBottom: "1px solid #f0c9dc",
              flexWrap: "wrap",
            }}
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => goTo(t.key)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "11px 18px",
                    borderRadius: 999,
                    flex: "none",
                    whiteSpace: "nowrap",
                    background: active ? "var(--accent)" : "#ecdde5",
                    color: active ? "#fff" : "#7f5f70",
                    boxShadow: active
                      ? "inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(122,0,72,0.45)"
                      : "inset 0 1px 0 #fff",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "home" && (
            <HomeTab
              messages={messages}
              onGoGuestbook={() => goTo("guestbook")}
              onGoPhotos={() => goTo("photos")}
            />
          )}
          {tab === "sounds" && (
            <SoundsTab
              playlist={playlist}
              songBy={songBy}
              onSongByChange={setSongBy}
              selectedTrack={selectedTrack}
              onSelectTrack={setSelectedTrack}
              onClearSelectedTrack={() => setSelectedTrack(null)}
              notice={soundsNotice}
              onAddSong={addSong}
            />
          )}
          {tab === "photos" && <PhotosTab />}
          {tab === "guestbook" && (
            <GuestbookTab
              messages={messages}
              liked={liked}
              onToggleLike={toggleLike}
              formName={formName}
              formBody={formBody}
              onFormNameChange={setFormName}
              onFormBodyChange={setFormBody}
              notice={notice}
              onPostMessage={postMessage}
            />
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "16px 40px",
            textAlign: "center",
            fontFamily: "var(--font-vt323)",
            fontSize: 18,
            color: "#8a5875",
            letterSpacing: "0.06em",
          }}
        >
          made by her friends · best viewed with the sound on · © 2026 audreyware
        </div>
      </div>
    </div>
  );
}
