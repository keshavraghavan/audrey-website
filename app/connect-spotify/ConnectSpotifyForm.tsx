"use client";

import { useActionState } from "react";
import { connectSpotify } from "@/app/actions";

type FormState = { ok: false; error: string } | null;

export default function ConnectSpotifyForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    const passphrase = String(formData.get("passphrase") ?? "");
    const result = await connectSpotify(passphrase);
    return result ?? null;
  }, null);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
      <input
        type="password"
        name="passphrase"
        placeholder="passphrase"
        style={{ border: "1px solid #ccc", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          border: "none",
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          background: "#1DB954",
          color: "#fff",
        }}
      >
        {pending ? "Connecting…" : "Connect Spotify"}
      </button>
      {state && !state.ok && <div style={{ color: "#a3005e", fontSize: 13 }}>{state.error}</div>}
    </form>
  );
}
