const PREFIX = 'animio_';

export interface PlayerPrefs {
  volume: number;
  playbackRate: number;
  hlsQualityLevel: number;
  streamSourceIdx: number;
  /** AnimeKai streaming host (krakenfiles, mixdrop, …) */
  streamHostIndex: number;
  watchAudio: 'sub' | 'dub';
}

export interface ContinueEntry {
  mode: 'kai' | 'al';
  kaiId: string;
  alId?: number;
  epId: string;
  epNum: number;
  title: string;
  cover: string;
  at: number;
  updated: number;
}

export type WatchlistEntry =
  | { type: 'al'; id: number }
  | { type: 'kai'; id: string; title: string; image: string };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* quota */ }
}

export function getPrefs(): PlayerPrefs {
  const p = readJson<Partial<PlayerPrefs>>('prefs', {});
  return {
    volume: p.volume ?? 1,
    playbackRate: p.playbackRate ?? 1,
    hlsQualityLevel: p.hlsQualityLevel ?? -1,
    streamSourceIdx: p.streamSourceIdx ?? 0,
    streamHostIndex: p.streamHostIndex ?? 0,
    watchAudio: p.watchAudio === 'dub' ? 'dub' : 'sub',
  };
}

export function savePrefs(partial: Partial<PlayerPrefs>) {
  writeJson('prefs', { ...getPrefs(), ...partial });
}

export function getReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PREFIX + 'reduce_motion');
    if (raw === null) {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function setReduceMotion(value: boolean) {
  writeJson('reduce_motion', value);
}

export function getContinue(): ContinueEntry | null {
  return readJson<ContinueEntry | null>('continue', null);
}

export function saveContinue(entry: ContinueEntry) {
  writeJson('continue', entry);
}

export function clearContinue() {
  try {
    localStorage.removeItem(PREFIX + 'continue');
  } catch { /* */ }
}

export function getWatchlist(): WatchlistEntry[] {
  return readJson<WatchlistEntry[]>('watchlist', []);
}

export function addWatchlistEntry(entry: WatchlistEntry): boolean {
  const list = getWatchlist();
  if (entry.type === 'al') {
    if (list.some((e) => e.type === 'al' && e.id === entry.id)) return false;
    writeJson('watchlist', [{ type: 'al', id: entry.id }, ...list].slice(0, 50));
    return true;
  }
  if (list.some((e) => e.type === 'kai' && e.id === entry.id)) return false;
  writeJson('watchlist', [entry, ...list].slice(0, 50));
  return true;
}

export function removeWatchlistEntry(entry: WatchlistEntry) {
  const list = getWatchlist().filter((e) => {
    if (e.type !== entry.type) return true;
    if (e.type === 'al' && entry.type === 'al') return e.id !== entry.id;
    return e.id !== (entry as { id: string }).id;
  });
  writeJson('watchlist', list);
}
