import { getDb } from "../lib/db";
import { guestbookMessages } from "../lib/db/schema";

// The 4 messages the guestbook has always shipped with (previously
// `SEED_MESSAGES` in lib/audrey-data.ts, which this script replaces as the
// source of truth — run once, then the seed array is deleted in Task 4).
const SEED = [
  {
    name: "Priya",
    body: 'First memory: you at the kitchen table at 1am, three books open, telling me you were "almost done." You were on page nine of all three. Happiest birthday, my favorite over-committer.',
    likes: 7,
  },
  {
    name: "Dad",
    body: "Twenty-four years ago you arrived two weeks late, already on your own schedule. Nothing has changed. We love you.",
    likes: 12,
  },
  {
    name: "Marcus",
    body: "You have never once let us pick the book and honestly the record speaks for itself. 24 looks good on you.",
    likes: 5,
  },
  {
    name: "Jules",
    body: "First time I met you, you asked what I was reading before you asked my name. Still the best introduction I've ever gotten.",
    likes: 9,
  },
];

async function main() {
  const db = getDb();
  for (const message of SEED) {
    await db.insert(guestbookMessages).values({
      name: message.name,
      body: message.body,
      likes: message.likes,
      photoUrls: [],
    });
  }
  console.log(`Inserted ${SEED.length} seed guestbook messages.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
