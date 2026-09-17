import AudreySite from "@/components/AudreySite";
import { getTracks } from "@/lib/db";

export default async function Page() {
  let tracks: Awaited<ReturnType<typeof getTracks>> = [];
  try {
    tracks = await getTracks();
  } catch (err) {
    console.error("Failed to load tracks:", err);
  }
  return <AudreySite initialTracks={tracks} />;
}
