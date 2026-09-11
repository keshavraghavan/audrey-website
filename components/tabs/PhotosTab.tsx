import PhotoSlot from "@/components/PhotoSlot";
import { ALBUM } from "@/lib/audrey-data";

export default function PhotosTab() {
  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
        THE ALBUM
      </h2>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7f5f70" }}>
        Everyone drops their photos of her here. {ALBUM.length} so far.
      </p>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 14 }}>
        {ALBUM.map((p, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              background: "#fdf7f9",
              boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.1)",
              padding: "9px 9px 0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", borderRadius: 7, overflow: "hidden" }}>
              <PhotoSlot id={`album-${i}`} background={p.color} radius={7} placeholder="drop a photo" />
            </div>
            <div style={{ padding: "9px 2px 11px", fontSize: 11, color: "#8a5875" }}>{p.caption}</div>
          </div>
        ))}
        <div
          style={{
            borderRadius: 12,
            border: "2px dashed #eeb0cf",
            background: "#f7edf2",
            minHeight: 150,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            cursor: "pointer",
          }}
        >
          <div style={{ fontFamily: "var(--font-vt323)", fontSize: 30, color: "#ff8ec9" }}>+</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dark)", textAlign: "center", lineHeight: 1.5 }}>
            DROP YOUR
            <br />
            PHOTOS
          </div>
        </div>
      </div>
    </div>
  );
}
