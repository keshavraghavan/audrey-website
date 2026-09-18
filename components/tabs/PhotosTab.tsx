import type { AlbumPhoto } from "@/lib/audrey-data";

export default function PhotosTab({
  photos,
  uploading,
  notice,
  onAddPhotos,
}: {
  photos: AlbumPhoto[];
  uploading: boolean;
  notice: string;
  onAddPhotos: (files: FileList) => void;
}) {
  return (
    <div style={{ padding: "clamp(22px, 3vw, 34px) clamp(16px, 3vw, 40px) 46px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-archivo-black)", fontSize: 30, color: "var(--accent)", letterSpacing: "-0.025em" }}>
        ALBUM PHOTOS
      </h2>

      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 14 }}>
        {photos.map((p) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4/3",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 3px 0 #f4d3e3, 0 8px 18px rgba(163,0,94,0.1)",
            }}
          >
            {/* Visitor-uploaded Blob URLs, not a next/image-optimizable local/remote-pattern asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ))}
        <label
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
            cursor: uploading ? "default" : "pointer",
          }}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onAddPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <div style={{ fontFamily: "var(--font-vt323)", fontSize: 30, color: "#ff8ec9" }}>+</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-dark)", textAlign: "center", lineHeight: 1.5 }}>
            {uploading ? "UPLOADING…" : (
              <>
                DROP YOUR
                <br />
                PHOTOS
              </>
            )}
          </div>
        </label>
      </div>
      {notice && <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: "#a3005e" }}>{notice}</div>}
      {photos.length === 0 && !uploading && (
        <p style={{ marginTop: 14, fontSize: 12, color: "#8a5875" }}>No photos yet — be the first to add one.</p>
      )}
    </div>
  );
}
