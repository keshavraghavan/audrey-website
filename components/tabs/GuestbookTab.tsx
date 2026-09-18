import type { GuestbookMessage, MessageTint } from "@/lib/audrey-data";

function tintStyle(tint: MessageTint) {
  if (tint === "teal") {
    return { background: "linear-gradient(#fbf7f7, #eaf4f4)", boxShadow: "0 3px 0 #cfe9e9, 0 10px 22px rgba(0,92,92,0.1)" };
  }
  if (tint === "gold") {
    return { background: "linear-gradient(#fdf9f4, #f6efe2)", boxShadow: "0 3px 0 #f2e0be, 0 10px 22px rgba(163,120,0,0.1)" };
  }
  return { background: "linear-gradient(#fdf7f9, #f6e8ef)", boxShadow: "0 3px 0 #f4d3e3, 0 10px 22px rgba(163,0,94,0.1)" };
}

const inputStyle = {
  border: "none",
  borderRadius: 999,
  background: "#fdf8fa",
  boxShadow: "inset 0 0 0 1px #f0c9dc",
  padding: "10px 14px",
  fontSize: 12,
  color: "#4a3341",
};

export default function GuestbookTab({
  messages,
  liked,
  onToggleLike,
  formName,
  formBody,
  onFormNameChange,
  onFormBodyChange,
  notice,
  onPostMessage,
  photoUrls,
  uploadingPhotos,
  onAddPhotos,
}: {
  messages: GuestbookMessage[];
  liked: Record<string, boolean>;
  onToggleLike: (id: string) => void;
  formName: string;
  formBody: string;
  onFormNameChange: (value: string) => void;
  onFormBodyChange: (value: string) => void;
  notice: string;
  onPostMessage: () => void;
  photoUrls: string[];
  uploadingPhotos: boolean;
  onAddPhotos: (files: FileList) => void;
}) {
  return (
    <div
      style={{
        padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 34,
        alignItems: "start",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
            GUESTBOOK
          </h2>
          <span style={{ fontSize: 11, color: "#8a5875" }}>{messages.length} messages · newest first</span>
        </div>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m) => {
            const isLiked = !!liked[m.id];
            const likeCount = m.likes;
            return (
              <div key={m.id} style={{ borderRadius: 12, padding: "18px 20px", ...tintStyle(m.tint) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.swatch, flex: "none" }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7a0048" }}>
                    {m.name} <span style={{ fontWeight: 400, color: "#8a5875" }}>{m.meta}</span>
                  </div>
                </div>
                <p style={{ margin: "11px 0 0", fontSize: 14, lineHeight: 1.8, color: "#4a3341", textWrap: "pretty" }}>
                  {m.body}
                </p>
                {m.photoUrls.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 9 }}>
                    {m.photoUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element -- visitor-uploaded Blob URLs, not a next/image-optimizable local/remote-pattern asset for this pass
                      <img key={url} src={url} alt="" referrerPolicy="no-referrer" style={{ width: 104, height: 78, borderRadius: 8, objectFit: "cover" }} />
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => onToggleLike(m.id)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "10px 18px",
                      background: isLiked ? "linear-gradient(#ff5fb0, #d6006e)" : "#fdf7f9",
                      color: isLiked ? "#fff" : "#d6006e",
                      boxShadow: isLiked ? "0 2px 0 #a3005e" : "inset 0 0 0 1px #f0c9dc",
                    }}
                  >
                    ♡ {likeCount}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          background: "linear-gradient(#fdf7f9, #f6e8ef)",
          boxShadow: "0 3px 0 #f4d3e3, 0 12px 26px rgba(163,0,94,0.12)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 11,
          position: "sticky",
          top: 20,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-dark)" }}>YOUR MESSAGE</div>
        <div style={{ fontSize: 11, lineHeight: 1.65, color: "#7f5f70" }}>
          The prompt, if you want one: <em>the first time I met Audrey…</em>
        </div>
        <input value={formName} onChange={(e) => onFormNameChange(e.target.value)} placeholder="your name" style={inputStyle} />
        <textarea
          value={formBody}
          onChange={(e) => onFormBodyChange(e.target.value)}
          placeholder="happy birthday, Audrey…"
          style={{
            border: "none",
            borderRadius: 12,
            background: "#fdf8fa",
            boxShadow: "inset 0 0 0 1px #f0c9dc",
            padding: "12px 14px",
            fontSize: 12,
            lineHeight: 1.7,
            color: "#4a3341",
            minHeight: 110,
            resize: "vertical",
          }}
        />
        <label
          style={{
            borderRadius: 10,
            border: "2px dashed #eeb0cf",
            background: "#f7edf2",
            padding: 12,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-dark)",
            cursor: photoUrls.length >= 3 || uploadingPhotos ? "default" : "pointer",
            opacity: photoUrls.length >= 3 ? 0.6 : 1,
            display: "block",
          }}
        >
          {uploadingPhotos ? "UPLOADING…" : photoUrls.length >= 3 ? "3 PHOTOS ATTACHED" : "+ ADD PHOTOS (3 MAX)"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={photoUrls.length >= 3 || uploadingPhotos}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onAddPhotos(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>
        {photoUrls.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {photoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- visitor-uploaded Blob URLs, not a next/image-optimizable local/remote-pattern asset for this pass
              <img key={url} src={url} alt="" referrerPolicy="no-referrer" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />
            ))}
          </div>
        )}
        <button
          onClick={onPostMessage}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            background: "linear-gradient(var(--accent-soft), var(--accent-dark))",
            border: "none",
            borderRadius: 999,
            padding: 13,
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 0 #a3005e",
            cursor: "pointer",
          }}
        >
          Post it
        </button>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#00807f", minHeight: 13 }}>{notice}</div>
      </div>
    </div>
  );
}
