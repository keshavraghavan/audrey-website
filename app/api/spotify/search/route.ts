import { NextRequest, NextResponse } from "next/server";
import { searchTracks, SpotifyNotConfiguredError, SpotifyRequestError } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchTracks(q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Spotify search error:", err);

    // The error code is deliberately coarse — it names which step failed and
    // nothing else, so it's safe to read straight off the network tab when
    // the server logs aren't handy. Never include the Spotify response body:
    // that can quote the credentials back at us.
    if (err instanceof SpotifyNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    if (err instanceof SpotifyRequestError && err.step === "token") {
      // Spotify refused our client credentials — wrong or rotated secret, or
      // whitespace picked up when they were pasted into the host's dashboard.
      return NextResponse.json({ error: "spotify_auth_rejected" }, { status: 502 });
    }
    if (err instanceof SpotifyRequestError) {
      return NextResponse.json({ error: "spotify_error", status: err.status }, { status: 502 });
    }
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
