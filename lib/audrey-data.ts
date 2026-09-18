// Seed content for the birthday site.
// Guestbook messages and the playlist are persisted to localStorage once a
// visitor adds their own — these arrays are only the starting state.

export type Tab = "home" | "guestbook" | "sounds" | "photos";

export const TABS: { key: Tab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "guestbook", label: "Guestbook" },
  { key: "sounds", label: "Her sounds" },
  { key: "photos", label: "Album photos" },
];

export type MessageTint = "pink" | "teal" | "gold";

const TINTS: MessageTint[] = ["pink", "teal", "gold"];

const SWATCHES: Record<MessageTint, string> = {
  pink: "linear-gradient(135deg, #ff8ec9, #d6006e)",
  teal: "linear-gradient(135deg, #7de3e3, #009a9a)",
  gold: "linear-gradient(135deg, #ffe680, #ffb300)",
};

// Real messages have no UI field for picking a color, so the tint is a
// deterministic hash of the message id — stable across reloads without
// storing it.
function deriveTint(id: string): MessageTint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export type GuestbookMessage = {
  id: string;
  name: string;
  meta: string;
  swatch: string;
  tint: MessageTint;
  likes: number;
  body: string;
  photoUrls: string[];
};

type GuestbookMessageSource = {
  id: string;
  name: string;
  body: string;
  photoUrls: string[];
  likes: number;
  createdAt: Date;
};

export function toGuestbookMessage(row: GuestbookMessageSource): GuestbookMessage {
  const tint = deriveTint(row.id);
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    photoUrls: row.photoUrls,
    likes: row.likes,
    tint,
    swatch: SWATCHES[tint],
    meta: formatTimeAgo(row.createdAt),
  };
}

export type Track = {
  id: string;
  spotifyId: string;
  spotifyUri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  addedBy: string;
};

export type AlbumPhoto = { id: string; url: string };

type AlbumPhotoSource = { id: string; url: string };

export function toAlbumPhoto(row: AlbumPhotoSource): AlbumPhoto {
  return { id: row.id, url: row.url };
}

export const BAR_HEIGHTS = [40, 80, 55, 100, 30, 70, 45, 90, 62, 35, 85, 50, 74, 42];
export const BAR_COLORS = ["#ff2d95", "#ff5fb0", "#00ff9d", "#7de3e3", "#ffb300"];

export const NAME = "Audrey";
export const AGE = 24;
export const ACCENT = "#ff2d95";
export const BIRTHDAY = new Date(2026, 8, 20); // September 20th, 2026
