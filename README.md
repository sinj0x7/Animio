# Animio

3D hero + anime discovery (AniList) + **streaming** via a local API powered by [@consumet/extensions](https://github.com/consumet/extensions) (AnimeKai provider).

## Why a local API?

The public `https://api.consumet.org` host is **no longer reliable**. This project runs the same scrapers **on your machine** with Express + CORS, so the frontend can load episodes and **HLS (m3u8)** URLs safely.

## Run

```bash
npm install
npm run dev
```

This starts:

- **API** → `http://localhost:3001` (`npm run server`)
- **Vite** → `http://localhost:5173` with `/api` proxied to the API

Or run them separately:

```bash
npm run server   # API only
npm run dev:web  # frontend only (API must still be running)
```

## API routes (proxied as `/api/...` in dev)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/top-airing` | Spotlight / top shows |
| GET | `/api/search/:query` | Search |
| GET | `/api/info/:id` | Episodes + metadata |
| GET | `/api/watch?episodeId=...` | HLS sources + subtitles |
| GET | `/api/hls?url=...` | **Proxy** for m3u8 + `.ts` segments (required — CDNs block browser CORS) |

## Production

Set `VITE_API_URL` to your deployed API base (e.g. `https://your-api.example.com/api`) before `npm run build`, or put the Express app behind the same origin and reverse-proxy `/api`.
