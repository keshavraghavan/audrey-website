This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment variables

All five are required in every environment the site runs in, including
Production on the host. `.env.local` is gitignored, so nothing here ships with
the repo.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. |
| `SPOTIFY_CLIENT_ID` | From the Spotify app dashboard. |
| `SPOTIFY_CLIENT_SECRET` | Same. |
| `SPOTIFY_REDIRECT_URI` | Must be the deployment's own origin, e.g. `https://<domain>/api/spotify/callback`, and registered verbatim on the Spotify app. |
| `CONNECT_PASSPHRASE` | Gates `/connect-spotify`. At least 8 characters, or the gate fails closed. |

On Vercel these are baked into a deployment at build time and scoped per
environment, so adding one to Production does **not** affect the deployment
already running — redeploy after any change, and check the deployment's own
env list rather than just the project settings page.

### Diagnosing song search

`GET /api/spotify/search` returns a coarse error code, readable straight off
the browser's network tab:

| Status | `error` | Means |
| --- | --- | --- |
| 503 | `not_configured` | `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` are missing or blank in this deployment. |
| 502 | `spotify_auth_rejected` | Spotify refused our client credentials — wrong, rotated, or whitespace picked up when pasting. |
| 502 | `spotify_error` | Credentials were accepted; Spotify refused the search itself. `status` carries its status code. |
| 500 | `search_failed` | Couldn't reach Spotify at all. |

The server log for the same request carries Spotify's own response body, which
names the reason (`invalid_client` and so on).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
