import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const results = await searchTracks(q);
    return NextResponse.json(results);
  } catch (err) {
    console.error("Spotify search error:", err);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
