/**
 * Consumet-style HTTP API (gogoanime routes) + Jikan v4 fallback for top airing.
 * Default host often redirects; set VITE_CONSUMET_API_BASE at build time to a working instance.
 */
import type { AnimeResult, Episode, PagedResult, StreamData, StreamSource } from './animeapi';

const DEFAULT_CONSUMET =
  (import.meta.env.VITE_CONSUMET_API_BASE as string | undefined)?.replace(/\/$/, '') ??
  'https://api.consumet.org/anime/gogoanime';

async function consumetGetJson<T>(path: string): Promise<T> {
  const url = `${DEFAULT_CONSUMET}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error(`Consumet returned non-JSON (${res.status})`);
  }
  if (!res.ok) throw new Error(`Consumet ${res.status}`);
  return res.json() as Promise<T>;
}

// --- Search / info / watch (public API shape) --------------------------------

interface ConsumetSearchResult {
  id: string;
  title: string;
  image?: string;
  url?: string;
}

interface ConsumetSearchResponse {
  results?: ConsumetSearchResult[];
  currentPage?: number;
  hasNextPage?: boolean;
}

interface ConsumetEpisodeRaw {
  id: string;
  number?: number | string;
  title?: string;
}

interface ConsumetInfoResponse {
  id: string;
  title?: string;
  image?: string;
  episodes?: ConsumetEpisodeRaw[];
}

interface ConsumetSourceRaw {
  url: string;
  quality?: string;
  isM3U8?: boolean;
}

interface ConsumetWatchResponse {
  headers?: { Referer?: string; referer?: string };
  sources?: ConsumetSourceRaw[];
  subtitles?: { url: string; lang?: string; kind?: string }[];
}

function qualityRank(q: string | undefined): number {
  if (!q) return 0;
  const m = String(q).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function normalizeConsumetWatch(raw: ConsumetWatchResponse): StreamData {
  const list = raw.sources ?? [];
  const m3u8 = list.filter((s) => s.isM3U8 || s.url.includes('.m3u8'));
  const pick = m3u8.length ? m3u8 : list;
  const sorted = [...pick].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  const sources: StreamSource[] = sorted.map((s) => ({
    url: s.url,
    isM3U8: !!(s.isM3U8 || s.url.includes('.m3u8')),
    quality: s.quality,
  }));
  const subtitles =
    raw.subtitles?.map((s) => ({
      kind: 'captions',
      url: s.url,
      lang: s.lang ?? 'en',
    })) ?? [];
  const ref = raw.headers?.Referer ?? raw.headers?.referer;
  return {
    headers: ref ? { Referer: ref } : undefined,
    sources,
    subtitles,
  };
}

export async function consumetSearch(title: string): Promise<ConsumetSearchResponse> {
  const q = title.trim();
  if (!q) return { results: [] };
  return consumetGetJson<ConsumetSearchResponse>(`/search/${encodeURIComponent(q)}`);
}

export async function consumetInfo(animeId: string): Promise<ConsumetInfoResponse> {
  return consumetGetJson<ConsumetInfoResponse>(`/info/${encodeURIComponent(animeId)}`);
}

export async function consumetWatch(episodeId: string): Promise<StreamData> {
  const raw = await consumetGetJson<ConsumetWatchResponse>(
    `/watch/${encodeURIComponent(episodeId)}`,
  );
  return normalizeConsumetWatch(raw);
}

export function mapConsumetEpisodes(episodes: ConsumetEpisodeRaw[] | undefined): Episode[] {
  if (!episodes?.length) return [];
  return episodes.map((e) => ({
    id: e.id,
    number: typeof e.number === 'number' ? e.number : Number(e.number) || 0,
    title: e.title,
    isSubbed: true,
  }));
}

export function mapConsumetSearchResults(r: ConsumetSearchResult[]): AnimeResult[] {
  return r.map((x) => ({
    id: x.id,
    title: x.title,
    image: x.image ?? '',
    url: x.url,
  }));
}

// --- Top airing: try Consumet, else Jikan v4 ----------------------------------

interface JikanTopData {
  mal_id: number;
  title?: string;
  titles?: { type?: string; title?: string }[];
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
}

interface JikanTopResponse {
  pagination: { current_page: number; has_next_page: boolean };
  data: JikanTopData[];
}

function jikanTitle(d: JikanTopData): string {
  const en = d.titles?.find((t) => t.type === 'English')?.title;
  return en || d.title || 'Unknown';
}

async function fetchJikanTopAiring(): Promise<PagedResult> {
  const res = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=25');
  if (!res.ok) throw new Error(`Jikan ${res.status}`);
  const json = (await res.json()) as JikanTopResponse;
  const results: AnimeResult[] = json.data.map((d) => ({
    id: String(d.mal_id),
    title: jikanTitle(d),
    image: d.images?.jpg?.large_image_url ?? d.images?.jpg?.image_url ?? '',
  }));
  return {
    currentPage: json.pagination.current_page,
    hasNextPage: json.pagination.has_next_page,
    results,
  };
}

export async function fetchTopAiringPaged(): Promise<PagedResult> {
  try {
    const raw = await consumetGetJson<{
      results?: ConsumetSearchResult[];
      currentPage?: number;
      hasNextPage?: boolean;
    }>('/top-airing');
    const list = raw.results ?? [];
    if (list.length === 0) throw new Error('empty consumet top-airing');
    return {
      currentPage: raw.currentPage ?? 1,
      hasNextPage: raw.hasNextPage ?? false,
      results: mapConsumetSearchResults(list),
    };
  } catch {
    return fetchJikanTopAiring();
  }
}
