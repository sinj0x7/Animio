import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AniMedia } from '../lib/anilist';
import type { AnimeResult } from '../lib/animeapi';
import { animeApi, type Episode } from '../lib/animeapi';
import { VideoPlayer } from './VideoPlayer';
import { EpisodeList } from './EpisodeList';
import { replaceWatchUrl } from '../lib/watchUrl';
import { saveContinue, getPrefs, savePrefs } from '../lib/localStore';

export type WatchSource =
  | { mode: 'anilist'; anime: AniMedia }
  | { mode: 'animekai'; anime: AnimeResult };

interface WatchPageProps {
  source: WatchSource;
  onBack: () => void;
  initialEpisodeId?: string | null;
  /** Pre-selected AnimeKai id (e.g. from URL kid=) when AniList match is ambiguous */
  initialKaiOverrideId?: string | null;
}

export const WatchPage = ({
  source,
  onBack,
  initialEpisodeId,
  initialKaiOverrideId,
}: WatchPageProps) => {
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [userPickedKaiId, setUserPickedKaiId] = useState<string | null>(null);
  const [hostIndex, setHostIndex] = useState(() => getPrefs().streamHostIndex);
  const [watchAudio, setWatchAudio] = useState<'sub' | 'dub'>(() => getPrefs().watchAudio);

  const title =
    source.mode === 'anilist'
      ? source.anime.title.english || source.anime.title.romaji
      : source.anime.title;

  const poster =
    source.mode === 'anilist'
      ? source.anime.bannerImage ?? source.anime.coverImage.extraLarge
      : source.anime.banner ?? source.anime.image;

  const cover =
    source.mode === 'anilist'
      ? source.anime.coverImage.large
      : source.anime.image;

  const searchTitle = source.mode === 'anilist' ? source.anime.title.romaji : null;
  const directId = source.mode === 'animekai' ? source.anime.id : null;

  const searchQuery = useQuery({
    queryKey: ['animekai-search', searchTitle],
    queryFn: () => animeApi.search(searchTitle!),
    enabled: source.mode === 'anilist' && !!searchTitle,
    staleTime: 10 * 60 * 1000,
  });

  const searchResults = searchQuery.data?.results ?? [];
  const pickedKai = userPickedKaiId ?? initialKaiOverrideId ?? null;

  const animeKaiId =
    source.mode === 'animekai'
      ? directId
      : searchResults.length === 1
        ? searchResults[0].id
        : pickedKai;

  const showMatchPicker =
    source.mode === 'anilist' &&
    searchQuery.isFetched &&
    searchResults.length > 1 &&
    !pickedKai;

  const infoQuery = useQuery({
    queryKey: ['animekai-info', animeKaiId],
    queryFn: () => animeApi.info(animeKaiId!),
    enabled: !!animeKaiId && !showMatchPicker,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const eps = infoQuery.data?.episodes;
    if (!eps?.length) return;
    if (initialEpisodeId) {
      const ep = eps.find((e) => e.id === initialEpisodeId);
      if (ep) {
        setSelectedEp(ep);
        return;
      }
    }
    setSelectedEp((prev) => prev ?? eps[0]);
  }, [infoQuery.data, initialEpisodeId]);

  useEffect(() => {
    if (!selectedEp) return;
    setHostIndex(getPrefs().streamHostIndex);
  }, [selectedEp?.id]);

  const serversQuery = useQuery({
    queryKey: ['animekai-servers', selectedEp?.id, watchAudio],
    queryFn: () => animeApi.servers(selectedEp!.id, watchAudio),
    enabled: !!selectedEp,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const list = serversQuery.data?.servers;
    if (!list?.length) return;
    setHostIndex((h) => Math.min(Math.max(0, h), list.length - 1));
  }, [serversQuery.data?.servers, selectedEp?.id]);

  const streamQuery = useQuery({
    queryKey: ['animekai-stream', selectedEp?.id, hostIndex, watchAudio],
    queryFn: () =>
      animeApi.watch(selectedEp!.id, { serverIndex: hostIndex, audio: watchAudio }),
    enabled:
      !!selectedEp &&
      serversQuery.isSuccess &&
      (serversQuery.data?.servers.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000,
  });

  const streamsLoading =
    !!selectedEp &&
    (serversQuery.isFetching || (serversQuery.isSuccess && streamQuery.isFetching));

  const setAudio = useCallback((a: 'sub' | 'dub') => {
    setWatchAudio(a);
    savePrefs({ watchAudio: a });
  }, []);

  const setHost = useCallback((i: number) => {
    setHostIndex(i);
    savePrefs({ streamHostIndex: i });
  }, []);

  useEffect(() => {
    if (!selectedEp || !animeKaiId) return;
    if (source.mode === 'anilist') {
      replaceWatchUrl({
        kind: 'al',
        alId: source.anime.id,
        epId: selectedEp.id,
        kid: pickedKai ?? undefined,
      });
    } else {
      replaceWatchUrl({ kind: 'kai', kaiId: animeKaiId, epId: selectedEp.id });
    }
  }, [selectedEp?.id, animeKaiId, pickedKai, source]);

  const handlePickKai = useCallback((id: string) => {
    setUserPickedKaiId(id);
    setSelectedEp(null);
    if (source.mode === 'anilist') {
      replaceWatchUrl({ kind: 'al', alId: source.anime.id, kid: id });
    }
  }, [source]);

  const handleEpisodeSelect = useCallback((ep: Episode) => {
    setSelectedEp(ep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePlaybackProgress = useCallback(
    (at: number, _dur: number) => {
      if (!selectedEp || !animeKaiId) return;
      saveContinue({
        mode: source.mode === 'anilist' ? 'al' : 'kai',
        kaiId: animeKaiId,
        alId: source.mode === 'anilist' ? source.anime.id : undefined,
        epId: selectedEp.id,
        epNum: selectedEp.number,
        title,
        cover: poster,
        at,
        updated: Date.now(),
      });
    },
    [selectedEp, animeKaiId, source, title, poster],
  );

  const episodes = infoQuery.data?.episodes ?? [];
  const currentIdx = episodes.findIndex((e) => e.id === selectedEp?.id);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) handleEpisodeSelect(episodes[currentIdx - 1]);
  }, [currentIdx, episodes, handleEpisodeSelect]);

  const handleNext = useCallback(() => {
    if (currentIdx < episodes.length - 1) handleEpisodeSelect(episodes[currentIdx + 1]);
  }, [currentIdx, episodes, handleEpisodeSelect]);

  const isLoading =
    source.mode === 'anilist'
      ? searchQuery.isLoading || (animeKaiId ? infoQuery.isLoading : false)
      : infoQuery.isLoading;

  const notFound =
    source.mode === 'anilist'
      ? searchQuery.isFetched && searchResults.length === 0
      : infoQuery.isError || (infoQuery.isFetched && !episodes.length);

  const hasStream = !!streamQuery.data?.sources?.length;

  if (source.mode === 'anilist' && showMatchPicker) {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-white">
        <header className="sticky top-0 z-50 bg-[#0B0C10]/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold truncate">Pick a match for “{title}”</h1>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
          <p className="text-white/50 text-sm mb-6">
            Multiple streaming catalog entries matched. Choose the one that matches your show.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handlePickKai(r.id)}
                className="text-left rounded-xl overflow-hidden border border-white/10 hover:border-pink-400/40 transition-colors bg-black/20"
              >
                <img src={r.image} alt="" className="w-full aspect-[3/4] object-cover" />
                <p className="p-2 text-xs text-white/80 line-clamp-2">{r.title}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white">
      <header className="sticky top-0 z-50 bg-[#0B0C10]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-semibold truncate">{title}</h1>
            {selectedEp && (
              <p className="text-xs text-white/40">
                Ep {selectedEp.number}{selectedEp.title ? ` — ${selectedEp.title}` : ''}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {selectedEp && serversQuery.isError && (
          <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-white/45 text-sm text-center">Could not load streaming hosts.</p>
            <button
              type="button"
              onClick={() => serversQuery.refetch()}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {selectedEp &&
          serversQuery.isFetched &&
          !serversQuery.isFetching &&
          !serversQuery.isError &&
          (serversQuery.data?.servers.length ?? 0) === 0 && (
            <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center text-sm text-white/50">
              No streaming hosts for {watchAudio === 'dub' ? 'dub' : 'sub'} on this episode. Try the other audio
              track.
            </div>
          )}

        {streamsLoading && (
          <div className="w-full aspect-video rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <p className="text-white/30 text-sm">Loading stream...</p>
          </div>
        )}

        {selectedEp &&
          serversQuery.isSuccess &&
          (serversQuery.data?.servers.length ?? 0) > 0 && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-white/35 w-full sm:w-auto">Audio</span>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button
                    type="button"
                    onClick={() => setAudio('sub')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      watchAudio === 'sub' ? 'bg-pink-500/30 text-white' : 'text-white/45 hover:bg-white/5'
                    }`}
                  >
                    Sub
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudio('dub')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      watchAudio === 'dub' ? 'bg-pink-500/30 text-white' : 'text-white/45 hover:bg-white/5'
                    }`}
                  >
                    Dub
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-white/35 block mb-2">Host</span>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                  {serversQuery.data!.servers.map((s) => (
                    <button
                      key={s.index}
                      type="button"
                      onClick={() => setHost(s.index)}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                        hostIndex === s.index
                          ? 'border-pink-400/50 bg-pink-500/15 text-white'
                          : 'border-white/10 bg-black/20 text-white/55 hover:border-white/20 hover:text-white/85'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

        {streamQuery.isError && selectedEp && !streamsLoading && (
          <div className="w-full aspect-video rounded-xl bg-white/5 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-white/40 text-sm text-center">Failed to load stream. Try another host or audio.</p>
            <button
              type="button"
              onClick={() => streamQuery.refetch()}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {hasStream && !streamsLoading && !streamQuery.isError && streamQuery.data && (
          <VideoPlayer
            stream={streamQuery.data}
            poster={poster}
            onPlaybackProgress={handlePlaybackProgress}
          />
        )}

        {!hasStream &&
          !streamsLoading &&
          !streamQuery.isError &&
          selectedEp &&
          serversQuery.isSuccess &&
          (serversQuery.data?.servers.length ?? 0) > 0 && (
            <div className="w-full aspect-video rounded-xl bg-white/5 flex flex-col items-center justify-center gap-2 p-6">
              <p className="text-white/40 text-sm text-center">No stream available for this episode.</p>
            </div>
          )}

        {notFound && (
          <div className="w-full aspect-video rounded-xl bg-white/5 flex flex-col items-center justify-center gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-white/40 text-sm text-center">Could not find streaming data for this anime.</p>
            <button type="button" onClick={onBack} className="mt-1 px-5 py-2 rounded-xl bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-colors">
              Go Back
            </button>
          </div>
        )}

        {isLoading && !notFound && !selectedEp && !showMatchPicker && (
          <div className="w-full aspect-video rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <p className="text-white/30 text-sm">Finding episodes...</p>
          </div>
        )}

        {episodes.length > 0 && selectedEp && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIdx <= 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>
            <span className="text-white/40 text-sm tabular-nums">
              Episode {selectedEp.number} / {episodes.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIdx >= episodes.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex gap-4 items-start p-4 rounded-xl bg-white/[0.03] border border-white/5">
          <img src={cover} alt={title} className="w-16 aspect-[3/4] rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">{title}</h2>
            {source.mode === 'anilist' && (
              <>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-white/40">
                  {source.anime.averageScore != null && (
                    <span className="text-pink-300">{(source.anime.averageScore / 10).toFixed(1)} Score</span>
                  )}
                  {source.anime.episodes != null && <span>{source.anime.episodes} episodes</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {source.anime.genres.slice(0, 4).map((g) => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">{g}</span>
                  ))}
                </div>
              </>
            )}
            {source.mode === 'animekai' && (
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-white/40">
                {source.anime.releaseDate && <span>{source.anime.releaseDate}</span>}
                {source.anime.type && <span>{source.anime.type}</span>}
                {(source.anime.sub != null || source.anime.dub != null) && (
                  <span>
                    {source.anime.sub != null && `${source.anime.sub} sub`}
                    {source.anime.sub != null && source.anime.dub != null && ' · '}
                    {source.anime.dub != null && `${source.anime.dub} dub`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">
            Episodes {episodes.length > 0 && <span className="text-white/30 text-base font-normal">({episodes.length})</span>}
          </h3>
          <EpisodeList
            episodes={episodes}
            currentEpisode={selectedEp?.id ?? null}
            onSelect={handleEpisodeSelect}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
