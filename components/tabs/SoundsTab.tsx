import { ARTISTS, type Track } from "@/lib/audrey-data";

const inputStyle = {
  border: "none",
  borderRadius: 999,
  background: "#fbf8f8",
  boxShadow: "inset 0 0 0 1px #bfe6e6",
  padding: "10px 14px",
  fontSize: 12,
  color: "#4a3341",
};

export default function SoundsTab({
  playlist,
  songTitle,
  songArtist,
  songBy,
  onSongTitleChange,
  onSongArtistChange,
  onSongByChange,
  onAddSong,
}: {
  playlist: Track[];
  songTitle: string;
  songArtist: string;
  songBy: string;
  onSongTitleChange: (value: string) => void;
  onSongArtistChange: (value: string) => void;
  onSongByChange: (value: string) => void;
  onAddSong: () => void;
}) {
  return (
    <div
      style={{
        padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 34,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
          HER SOUNDS
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>Top artists this year, straight from Spotify.</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {ARTISTS.map((a, i) => (
            <div
              key={a.name}
              style={{
                display: "flex",
                gap: 13,
                alignItems: "center",
                borderRadius: 12,
                background: "linear-gradient(#fdf7f9, #f6e8ef)",
                boxShadow: "0 3px 0 #f4d3e3",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontFamily: "var(--font-archivo-black)", fontSize: 18, color: "#ffb3dd", width: 24, flex: "none" }}>
                {i + 1}
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 9,
                  flex: "none",
                  background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})`,
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7a0048" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>{a.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "#00a3a3", letterSpacing: "-0.025em" }}>
          THE BIRTHDAY MIX
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>{playlist.length} songs, added by us. Put something on it.</p>
        <div
          style={{
            marginTop: 20,
            borderRadius: 14,
            background: "#fbf7f7",
            boxShadow: "0 3px 0 #cfe9e9, 0 10px 22px rgba(0,92,92,0.1)",
            overflow: "hidden",
          }}
        >
          {playlist.map((t, i) => (
            <div
              key={`${t.title}-${i}`}
              style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #eef0f0" }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  flex: "none",
                  background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "#8a5875" }}>{t.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: "#9c6d89", textAlign: "right" }}>
                added by
                <br />
                <span style={{ color: "var(--accent-dark)", fontWeight: 700 }}>{t.by}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: 14, background: "#eff7f7", display: "flex", flexDirection: "column", gap: 9 }}>
            <input
              value={songTitle}
              onChange={(e) => onSongTitleChange(e.target.value)}
              placeholder="song"
              style={inputStyle}
            />
            <input
              value={songArtist}
              onChange={(e) => onSongArtistChange(e.target.value)}
              placeholder="artist"
              style={inputStyle}
            />
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
          </div>
        </div>
      </div>
    </div>
  );
}
