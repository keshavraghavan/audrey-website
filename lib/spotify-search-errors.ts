// The error contract between /api/spotify/search and the Sounds tab. Shared so
// the two can't drift apart. Safe to import from Client Components.

export type SearchErrorCode = "not_configured" | "spotify_auth_rejected" | "spotify_error" | "search_failed";

export type SearchErrorBody = { error: SearchErrorCode; status?: number };

/**
 * True when retrying won't help — a config problem on our side, or Spotify
 * refusing the request outright. Rate limits, timeouts, and 5xx outages clear
 * on their own, so those stay retryable.
 */
export function isPermanentSearchError(body: Partial<SearchErrorBody> | null): boolean {
  if (!body) return false;
  if (body.error === "not_configured" || body.error === "spotify_auth_rejected") return true;
  if (body.error === "spotify_error" && body.status !== undefined) {
    return body.status >= 400 && body.status < 500 && body.status !== 408 && body.status !== 429;
  }
  return false;
}
