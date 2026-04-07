import { fetchTopAiringPaged } from './consumet';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

/** Full base for HLS proxy (same as JSON API, supports VITE_API_URL=http://host:3001/api). */
export function getHlsProxyBase(): string {
  if (API_BASE.startsWith('http')) {
    return API_BASE.replace(/\/$/, '');
  }
  if (typeof window === 'undefined') return '/api';
  return `${window.location.origin}${API_BASE.replace(/\/$/, '')}`;
}

export function hlsProxyUrl(remoteUrl: string, referer?: string): string {
  if (remoteUrl.includes('/hls?url=')) return remoteUrl;
  let u = `${getHlsProxyBase()}/hls?url=${encodeURIComponent(remoteUrl)}`;
  if (referer) u += `&ref=${encodeURIComponent(referer)}`;
  return u;
}

export interface AnimeResult {
  id: string;
  title: string;
  image: string;
  japaneseTitle?: string;
  type?: string;
  sub?: number;
  dub?: number;
  episodes?: number;
  banner?: string;
  description?: string;
  genres?: string[];
  releaseDate?: string;
  quality?: string;
  url?: string;
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  isFiller?: boolean;
  isSubbed?: boolean;
  isDubbed?: boolean;
}

export interface AnimeInfo {
  id: string;
  title: string;
  image: string;
  description?: string;
  genres?: string[];
  releaseDate?: string;
  type?: string;
  episodes: Episode[];
}

export interface StreamSource {
  url: string;
  isM3U8: boolean;
  quality?: string;
}

export interface Subtitle {
  kind: string;
  url: string;
  lang: string;
}

export interface StreamData {
  headers?: { Referer?: string };
  sources: StreamSource[];
  subtitles?: Subtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  download?: string;
}

export interface PagedResult {
  currentPage: number;
  hasNextPage: boolean;
  results: AnimeResult[];
}

export interface EpisodeServerEntry {
  index: number;
  name: string;
}

export interface EpisodeServersResult {
  audio: 'sub' | 'dub';
  servers: EpisodeServerEntry[];
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const animeApi = {
  topAiring: () => fetchTopAiringPaged(),
  spotlight: () => fetchApi<PagedResult>('/spotlight'),
  recent: () => fetchApi<PagedResult>('/recent'),
  newReleases: () => fetchApi<PagedResult>('/new-releases'),
  search: (query: string) => fetchApi<PagedResult>(`/search/${encodeURIComponent(query)}`),
  info: (id: string) => fetchApi<AnimeInfo>(`/info/${encodeURIComponent(id)}`),
  servers: (episodeId: string, audio: 'sub' | 'dub' = 'sub') =>
    fetchApi<EpisodeServersResult>(
      `/servers?episodeId=${encodeURIComponent(episodeId)}&audio=${encodeURIComponent(audio)}`,
    ),
  watch: (episodeId: string, opts?: { serverIndex?: number; audio?: 'sub' | 'dub' }) => {
    const q = new URLSearchParams({ episodeId });
    if (opts?.serverIndex != null) q.set('serverIndex', String(opts.serverIndex));
    if (opts?.audio) q.set('audio', opts.audio);
    return fetchApi<StreamData>(`/watch?${q}`);
  },
};
