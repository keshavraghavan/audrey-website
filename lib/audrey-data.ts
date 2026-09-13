// Seed content for the AudreyWare 24.0 birthday site.
// Guestbook messages and the playlist are persisted to localStorage once a
// visitor adds their own — these arrays are only the starting state.

export type Tab = "home" | "guestbook" | "sounds" | "photos";

export const TABS: { key: Tab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "guestbook", label: "Guestbook" },
  { key: "sounds", label: "Her sounds" },
  { key: "photos", label: "The album" },
];

export type MessageTint = "pink" | "teal" | "gold";

export type GuestbookMessage = {
  id: string;
  name: string;
  meta: string;
  swatch: string;
  tint: MessageTint;
  likes: number;
  body: string;
  photos?: boolean;
};

export const SEED_MESSAGES: GuestbookMessage[] = [
  {
    id: "s1",
    name: "Priya",
    meta: "roommate · 2 hours ago",
    swatch: "linear-gradient(135deg, #ff8ec9, #d6006e)",
    tint: "pink",
    likes: 7,
    body: 'First memory: you at the kitchen table at 1am, three books open, telling me you were "almost done." You were on page nine of all three. Happiest birthday, my favorite over-committer.',
  },
  {
    id: "s2",
    name: "Dad",
    meta: "yesterday",
    swatch: "linear-gradient(135deg, #7de3e3, #009a9a)",
    tint: "teal",
    likes: 12,
    photos: true,
    body: "Twenty-four years ago you arrived two weeks late, already on your own schedule. Nothing has changed. We love you.",
  },
  {
    id: "s3",
    name: "Marcus",
    meta: "book club · 2 days ago",
    swatch: "linear-gradient(135deg, #ffe680, #ffb300)",
    tint: "gold",
    likes: 5,
    body: "You have never once let us pick the book and honestly the record speaks for itself. 24 looks good on you.",
  },
  {
    id: "s4",
    name: "Jules",
    meta: "since freshman year · 3 days ago",
    swatch: "linear-gradient(135deg, #c9a7ff, #7a4dff)",
    tint: "pink",
    likes: 9,
    body: "First time I met you, you asked what I was reading before you asked my name. Still the best introduction I've ever gotten.",
  },
];

export type Track = {
  title: string;
  artist: string;
  by: string;
  colors: [string, string];
};

export const SEED_PLAYLIST: Track[] = [
  { title: "Paper Bag", artist: "Fiona Apple", by: "Priya", colors: ["#ff8ec9", "#c800a8"] },
  { title: "Belinda Says", artist: "Alvvays", by: "Jules", colors: ["#7de3e3", "#009a9a"] },
  { title: "Basketball Shoes", artist: "Black Country, New Road", by: "Marcus", colors: ["#ffe680", "#ffb300"] },
  { title: "Simulation Swarm", artist: "Big Thief", by: "Mom", colors: ["#c9a7ff", "#7a4dff"] },
  { title: "Birthday Song", artist: "Sun Ra", by: "Dad", colors: ["#ff6a3d", "#a8330f"] },
];

// The colors here also serve as each slot's placeholder background before a
// photo is dropped in — the slot id ("album-0", "album-1", ...) is the
// localStorage key, shared between the home-page preview tiles and the full
// album grid so a dropped photo shows up in both places.
export type AlbumPhoto = { caption: string; color: string };

export const ALBUM: AlbumPhoto[] = [
  { caption: "the lake, july", color: "#cdf3f3" },
  { caption: "book club, march", color: "#ffd9ec" },
  { caption: "her 23rd", color: "#fff0c2" },
  { caption: "graduation", color: "#e6dcff" },
  { caption: "kitchen table, 1am", color: "#ffe0d6" },
  { caption: "the bookstore trip", color: "#d9f2e4" },
  { caption: "halloween '24", color: "#ffd9ec" },
];

export const BAR_HEIGHTS = [40, 80, 55, 100, 30, 70, 45, 90, 62, 35, 85, 50, 74, 42];
export const BAR_COLORS = ["#ff2d95", "#ff5fb0", "#00ff9d", "#7de3e3", "#ffb300"];

export const SONG_PALETTES: [string, string][] = [
  ["#ff8ec9", "#c800a8"],
  ["#7de3e3", "#009a9a"],
  ["#ffe680", "#ffb300"],
  ["#c9a7ff", "#7a4dff"],
];

export const NAME = "Audrey";
export const AGE = 24;
export const ACCENT = "#ff2d95";
export const BIRTHDAY = new Date(2026, 8, 20); // September 20th, 2026
