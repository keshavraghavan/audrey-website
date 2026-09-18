import AudreySite from "@/components/AudreySite";
import { getTracks, getGuestbookMessages, getAlbumPhotos } from "@/lib/db";
import { toGuestbookMessage, toAlbumPhoto, type GuestbookMessage, type AlbumPhoto } from "@/lib/audrey-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  let tracks: Awaited<ReturnType<typeof getTracks>> = [];
  try {
    tracks = await getTracks();
  } catch (err) {
    console.error("Failed to load tracks:", err);
  }

  let messages: GuestbookMessage[] = [];
  try {
    const rows = await getGuestbookMessages();
    messages = rows.map(toGuestbookMessage);
  } catch (err) {
    console.error("Failed to load guestbook messages:", err);
  }

  let photos: AlbumPhoto[] = [];
  try {
    const rows = await getAlbumPhotos();
    photos = rows.map(toAlbumPhoto);
  } catch (err) {
    console.error("Failed to load album photos:", err);
  }

  return <AudreySite initialTracks={tracks} initialMessages={messages} initialPhotos={photos} />;
}
