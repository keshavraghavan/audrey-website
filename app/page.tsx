import AudreySite from "@/components/AudreySite";
import { getTracks, getGuestbookMessages } from "@/lib/db";
import { toGuestbookMessage, type GuestbookMessage } from "@/lib/audrey-data";

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

  return <AudreySite initialTracks={tracks} initialMessages={messages} />;
}
