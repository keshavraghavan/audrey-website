import ConnectSpotifyForm from "./ConnectSpotifyForm";

export default async function ConnectSpotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; count?: string }>;
}) {
  const { status, count } = await searchParams;

  if (status === "connected") {
    return (
      <main style={{ padding: 40, fontFamily: "Verdana, Geneva, sans-serif", maxWidth: 480, margin: "0 auto" }}>
        <h1>Connected ✅</h1>
        <p>
          Created the birthday playlist on your Spotify account
          {count ? ` with ${count} song${count === "1" ? "" : "s"} already on it` : ""}. New songs friends add
          will keep showing up there automatically.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, fontFamily: "Verdana, Geneva, sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <h1>Connect Spotify</h1>
      <p>Enter the passphrase to connect your Spotify account and create the birthday playlist.</p>
      <ConnectSpotifyForm />
    </main>
  );
}
