import type { CSSProperties } from "react";
import PhotoSlot from "@/components/PhotoSlot";
import { ALBUM, BAR_COLORS, BAR_HEIGHTS, type GuestbookMessage } from "@/lib/audrey-data";

// Always shown, even when the two columns stack on a narrow screen.
const PINNED_MESSAGES = 2;

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: "#8a5875" };

function MessageCard({ message, style }: { message: GuestbookMessage; style?: CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 12,
        background: "linear-gradient(#fdf7f9, #f6e8ef)",
        boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.08)",
        padding: "16px 18px",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: message.swatch, flex: "none" }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>
          {message.name} <span style={{ fontWeight: 400, color: "#8a5875" }}>{message.meta}</span>
        </div>
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 1.75, color: "#4a3341", textWrap: "pretty" }}>
        {message.body}
      </p>
    </div>
  );
}

export default function HomeTab({
  messages,
  onGoGuestbook,
  onGoPhotos,
}: {
  messages: GuestbookMessage[];
  onGoGuestbook: () => void;
  onGoPhotos: () => void;
}) {
  const photoTiles = ALBUM.slice(0, 4);

  return (
    <div
      style={{
        padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 44px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
        gap: 34,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={sectionLabel}>LATEST FROM THE GUESTBOOK</div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.slice(0, PINNED_MESSAGES).map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </div>
        {/* Older messages fill the height the right-hand column leaves free,
            whole cards only. flex-basis 0 keeps this box from ever making the
            row taller (it collapses when the columns stack); a card that
            doesn't fit wraps into a second flex column past the right edge,
            where overflow: hidden clips it. The negative margins + padding
            are just room for the card shadows. */}
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            alignContent: "flex-start",
            columnGap: 48,
            margin: "0 -24px -12px",
            padding: "0 24px 12px",
          }}
        >
          {/* Anchors the first flex line, so even the first card wraps away if it doesn't fit. */}
          <div style={{ width: "100%" }} />
          {messages.slice(PINNED_MESSAGES).map((m) => (
            <MessageCard key={m.id} message={m} style={{ width: "100%", marginTop: 10 }} />
          ))}
        </div>
        <button
          onClick={onGoGuestbook}
          style={{
            marginTop: 12,
            alignSelf: "flex-start",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-dark)",
            background: "#fdf7f9",
            border: "1px solid #f0c9dc",
            borderRadius: 999,
            padding: "9px 18px",
            cursor: "pointer",
          }}
        >
          Read all {messages.length} messages →
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ borderRadius: 14, overflow: "hidden", boxShadow: "0 3px 0 #cfe9e9, 0 10px 22px rgba(0,92,92,0.12)" }}>
          <div style={{ background: "linear-gradient(#7de3e3, #009a9a)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "7px 12px" }}>
            ♪ ON REPEAT
          </div>
          <div style={{ background: "#2b0a1e", padding: 14 }}>
            <div style={{ fontFamily: "var(--font-vt323)", fontSize: 20, color: "#00ff9d" }}>▶ Fetch the Bolt Cutters</div>
            <div style={{ fontFamily: "var(--font-vt323)", fontSize: 16, color: "#ff7ec2", marginTop: 2 }}>Fiona Apple — 4:32</div>
            <div style={{ marginTop: 12, display: "flex", gap: 2, alignItems: "flex-end", height: 30 }}>
              {BAR_HEIGHTS.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
              ))}
            </div>
          </div>
          <div style={{ background: "#faf2f5", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #7de3e3, #009a9a)", flex: "none" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>Alvvays</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>Blue Rev on loop</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #ffe680, #ffb300)", flex: "none" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>Black Country, New Road</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>Ants From Up There</div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 14,
            background: "#fdf7f9",
            boxShadow: "0 3px 0 #f4d3e3, 0 10px 22px rgba(163,0,94,0.1)",
            padding: "16px 18px",
          }}
        >
          <div style={sectionLabel}>THE ALBUM</div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {photoTiles.map((p, i) => (
              <div key={i} style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden" }}>
                <PhotoSlot id={`album-${i}`} background={p.color} radius={8} placeholder="drop a photo" />
              </div>
            ))}
          </div>
          <button
            onClick={onGoPhotos}
            style={{
              marginTop: 12,
              width: "100%",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(var(--accent-soft), var(--accent-dark))",
              border: "none",
              borderRadius: 999,
              padding: 10,
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.45), 0 3px 0 #a3005e",
              cursor: "pointer",
            }}
          >
            Add your photos
          </button>
        </div>
      </div>
    </div>
  );
}
