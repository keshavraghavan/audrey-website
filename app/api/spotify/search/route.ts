import { NextRequest, NextResponse } from "next/server";
import { isCredentialRejection, searchTracks, SpotifyNotConfiguredError, SpotifyRequestError } from "@/lib/spotify";
import type { SearchErrorBody } from "@/lib/spotify-search-errors";

function errorResponse(body: SearchErrorBody, status: number) {
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchTracks(q);
    return NextResponse.json(results);
  } catch (err) {
    // The full error, including Spotify's response body, goes to the server
    // log only — that's where the reason (`invalid_client` and so on) lives.
    // The public response stays coarse: which step failed and the upstream
    // status, readable straight off the network tab.
    console.error("Spotify search error:", err);

    if (err instanceof SpotifyNotConfiguredError) {
      return errorResponse({ error: "not_configured" }, 503);
    }
    if (isCredentialRejection(err)) {
      // Wrong or rotated client secret. Outages and rate limits at the token
      // endpoint fall through to spotify_error below, since those clear.
      return errorResponse({ error: "spotify_auth_rejected" }, 502);
    }
    if (err instanceof SpotifyRequestError) {
      return errorResponse({ error: "spotify_error", status: err.status }, 502);
    }
    return errorResponse({ error: "search_failed" }, 500);
  }
}
