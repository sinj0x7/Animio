import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { ANIME, SubOrSub } from '@consumet/extensions';
import { fileURLToPath } from 'url';
import path from 'path';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const logRequests = process.env.REQUEST_LOG === '1' || process.env.REQUEST_LOG === 'true';

// ─── Allowed CDN domains for the HLS proxy (prevents open-relay / SSRF) ─────
const DEFAULT_HLS_HOSTS = [
  '.megaup.cc',
  '.megaup.nl',
  '.megaup.live',
  '.shop21pro.site',
  '.net22lab.site',
  // MegaUp CDN rotation (AnimeKai / consumet)
  '.tech20hub.site',
];

function parseExtraHosts(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((h) => (h.startsWith('.') ? h : `.${h}`));
}

const EXTRA_HLS_HOSTS = parseExtraHosts(process.env.HLS_ALLOWED_HOSTS);
const ALLOWED_HOSTS = [...DEFAULT_HLS_HOSTS, ...EXTRA_HLS_HOSTS];

function isAllowedHost(hostname) {
  const h = String(hostname).toLowerCase();
  return ALLOWED_HOSTS.some(
    (suffix) => h === suffix.slice(1) || h.endsWith(suffix),
  );
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(compression());

if (isProd) {
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || origin === `http://localhost:${PORT}`),
    }),
  );
} else {
  app.use(cors());
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

const hlsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'rate limited',
});

if (logRequests) {
  app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

app.use('/api/hls', hlsLimiter);
app.use('/api', apiLimiter);

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Anime provider ─────────────────────────────────────────────────────────

const animekai = new ANIME.AnimeKai();

function displayServerName(raw) {
  if (!raw || typeof raw !== 'string') return 'Server';
  const s = raw.replace(/^megaup\s+/i, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Server';
}

// ─── HLS / segment proxy (streams, doesn't buffer) ──────────────────────────

app.get('/api/hls', async (req, res) => {
  const raw = req.query.url;
  if (!raw || typeof raw !== 'string') return res.status(400).send('missing url');

  let target;
  try {
    target = decodeURIComponent(raw);
  } catch {
    return res.status(400).send('bad url');
  }

  if (!/^https?:\/\//i.test(target)) return res.status(400).send('invalid url');

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).send('invalid url');
  }

  if (!isAllowedHost(parsed.hostname)) {
    return res.status(403).send('host not allowed');
  }

  const refHeader = req.query.ref ? decodeURIComponent(req.query.ref) : null;
  let refOrigin = parsed.origin;
  if (refHeader) {
    try { refOrigin = new URL(refHeader).origin; } catch { /* keep parsed.origin */ }
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: '*/*',
    Referer: refHeader || `${parsed.origin}/`,
    Origin: refOrigin,
  };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetch(target, { headers, redirect: 'follow' });
    const ct =
      upstream.headers.get('content-type') ||
      (target.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', ct);
    if (upstream.headers.get('content-range'))
      res.setHeader('Content-Range', upstream.headers.get('content-range'));

    const finalUrl = upstream.url || target;

    const isPlaylist =
      ct.includes('mpegurl') || ct.includes('m3u') || target.endsWith('.m3u8');

    if (isPlaylist && upstream.ok) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      let text = buf.toString('utf8');
      if (text.trimStart().startsWith('#EXTM3U')) {
        text = rewriteM3u8ToProxiedUrls(text, finalUrl, refHeader);
      }
      return res.status(upstream.status).send(Buffer.from(text, 'utf8'));
    }

    res.status(upstream.status);
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    console.error('hls proxy:', e.message);
    if (!res.headersSent) res.status(502).send('bad gateway');
  }
});

function proxyWrap(absoluteUrl, referer) {
  let p = `/api/hls?url=${encodeURIComponent(absoluteUrl)}`;
  if (referer) p += `&ref=${encodeURIComponent(referer)}`;
  return p;
}

function rewriteM3u8ToProxiedUrls(body, manifestUrl, referer) {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const abs = /^https?:\/\//i.test(uri) ? uri : new URL(uri, manifestUrl).href;
            return `URI="${proxyWrap(abs, referer)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const abs = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : new URL(trimmed, manifestUrl).href;
        return proxyWrap(abs, referer);
      } catch {
        return line;
      }
    })
    .join('\n');
}

// ─── API routes ──────────────────────────────────────────────────────────────

app.get('/api/top-airing', async (_req, res) => {
  try {
    res.json(await animekai.fetchSpotlight());
  } catch (e) {
    console.error('top-airing error:', e.message);
    res.status(500).json({ error: 'Failed to fetch top airing' });
  }
});

app.get('/api/spotlight', async (_req, res) => {
  try {
    res.json(await animekai.fetchSpotlight());
  } catch (e) {
    console.error('spotlight error:', e.message);
    res.status(500).json({ error: 'Failed to fetch spotlight' });
  }
});

app.get('/api/recent', async (_req, res) => {
  try {
    res.json(await animekai.fetchRecentlyUpdated());
  } catch (e) {
    console.error('recent error:', e.message);
    res.status(500).json({ error: 'Failed to fetch recent' });
  }
});

app.get('/api/new-releases', async (_req, res) => {
  try {
    res.json(await animekai.fetchNewReleases());
  } catch (e) {
    console.error('new-releases error:', e.message);
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

app.get('/api/search/:query', async (req, res) => {
  try {
    res.json(await animekai.search(req.params.query));
  } catch (e) {
    console.error('search error:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/info/:id', async (req, res) => {
  try {
    res.json(await animekai.fetchAnimeInfo(req.params.id));
  } catch (e) {
    console.error('info error:', e.message);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

app.get('/api/servers', async (req, res) => {
  try {
    const episodeId = req.query.episodeId;
    if (!episodeId || typeof episodeId !== 'string') {
      return res.status(400).json({ error: 'Missing episodeId query param' });
    }
    const audio = req.query.audio === 'dub' ? SubOrSub.DUB : SubOrSub.SUB;
    const list = await animekai.fetchEpisodeServers(episodeId, audio);
    res.json({
      audio: audio === SubOrSub.DUB ? 'dub' : 'sub',
      servers: list.map((s, index) => ({
        index,
        name: displayServerName(s.name),
      })),
    });
  } catch (e) {
    console.error('servers error:', e.message);
    res.status(500).json({ error: 'Failed to fetch streaming servers' });
  }
});

app.get('/api/watch', async (req, res) => {
  try {
    const episodeId = req.query.episodeId;
    if (!episodeId || typeof episodeId !== 'string') {
      return res.status(400).json({ error: 'Missing episodeId query param' });
    }

    if (episodeId.startsWith('http://') || episodeId.startsWith('https://')) {
      const data = await animekai.fetchEpisodeSources(episodeId);
      return res.json(data);
    }

    const audio = req.query.audio === 'dub' ? SubOrSub.DUB : SubOrSub.SUB;
    const serverIndex = Math.max(0, parseInt(String(req.query.serverIndex ?? '0'), 10) || 0);

    const servers = await animekai.fetchEpisodeServers(episodeId, audio);
    if (!servers.length) {
      return res.status(404).json({ error: 'No streaming servers for this episode' });
    }

    const idx = Math.min(serverIndex, servers.length - 1);
    const picked = servers[idx];
    const data = await animekai.fetchEpisodeSources(picked.url);
    data.intro = picked.intro ?? data.intro;
    data.outro = picked.outro ?? data.outro;
    res.json(data);
  } catch (e) {
    console.error('watch error:', e.message);
    res.status(500).json({ error: 'Failed to fetch streaming sources' });
  }
});

// ─── Serve frontend in production ────────────────────────────────────────────

const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath, { maxAge: isProd ? '7d' : 0 }));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`Animio running → http://localhost:${PORT} [${isProd ? 'production' : 'development'}]`);
  if (EXTRA_HLS_HOSTS.length) {
    console.log('[hls] extra allowed hosts from HLS_ALLOWED_HOSTS:', EXTRA_HLS_HOSTS.join(', '));
  }
});
server.ref();

setInterval(() => {}, 1 << 30);
