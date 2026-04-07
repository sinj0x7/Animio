import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AniMedia } from '../lib/anilist';
import type { AnimeResult, Episode } from '../lib/animeapi';
import {
  consumetSearch,
  consumetInfo,
  consumetWatch,
  mapConsumetEpisodes,
  mapConsumetSearchResults,
} from '../lib/consumet';
import { VideoPlayer } from './VideoPlayer';
import { EpisodeList } from './EpisodeList';
import { replaceWatchUrl } from '../lib/watchUrl';
import { saveContinue } from '../lib/localStore';

export type WatchSource =
  | { mode: 'anilist'; anime: AniMedia }
  | { mode: 'animekai'; anime: AnimeResult };

interface WatchPageProps {
  source: WatchSource;
  onBack: () => void;
  initialEpisodeId?: string | null;
  /** Pre-selected gogo slug when multiple Consumet search matches (from URL kid=) */
  initialKaiOverrideId?: string | null;
}

export const WatchPage = ({
  source,
  onBack,
  initialEpisodeId,
  initialKaiOverrideId,
}: WatchPageProps) => {
  const [selectedEp, setSelectedEp] = useState<Episode | null>(null);
  const [userPickedGogoId, setUserPickedGogoId] = useState<string | null>(null);

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

  const searchQuery = useQuery({
    queryKey: ['consumet-search', title],
    queryFn: () => consumetSearch(title),
    enabled: title.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const searchResults = mapConsumetSearchResults(searchQuery.data?.results ?? []);
  const pickedGogo = userPickedGogoId ?? initialKaiOverrideId ?? null;

  const showMatchPicker =
    searchQuery.isFetched && searchResults.length > 1 && !pickedGogo;

  const gogoAnimeId =
    pickedGogo ?? (searchResults.length === 1 ? searchResults[0].id : null);

  const infoQuery = useQuery({
    queryKey: ['consumet-info', gogoAnimeId],
    queryFn: () => consumetInfo(gogoAnimeId!),
    enabled: !!gogoAnimeId && !showMatchPicker,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const eps = mapConsumetEpisodes(infoQuery.data?.episodes);
    if (!eps.length) return;
    if (initialEpisodeId) {
      const ep = eps.find((e) => e.id === initialEpisodeId);
      if (ep) {
        setSelectedEp(ep);
        return;
      }
    }
    setSelectedEp((prev) => prev ?? eps[0]);
  }, [infoQuery.data, initialEpisodeId]);

  const streamQuery = useQuery({
    queryKey: ['consumet-watch', selectedEp?.id],
    queryFn: () => consumetWatch(selectedEp!.id),
    enabled: !!selectedEp && !!gogoAnimeId,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const streamsLoading = !!selectedEp && streamQuery.isFetching;
  const hasStream = !!(streamQuery.data?.sources?.length);

  const vidsrcEmbed =
    source.mode === 'anilist' &&
    source.anime.idMal != null &&
    source.anime.idMal > 0 &&
    selectedEp
      ? `https://vidsrc.to/embed/anime/${source.anime.idMal}/1/${selectedEp.number}`
      : null;

  const showEmbed =
    !!vidsrcEmbed &&
    (streamQuery.isError ||
      (streamQuery.isFetched && !streamQuery.isFetching && !hasStream));

  useEffect(() => {
    if (!selectedEp || !gogoAnimeId) return;
    if (source.mode === 'anilist') {
      replaceWatchUrl({
        kind: 'al',
        alId: source.anime.id,
        epId: selectedEp.id,
        kid: pickedGogo ?? undefined,
      });
    } else {
      replaceWatchUrl({ kind: 'kai', kaiId: gogoAnimeId, epId: selectedEp.id });
    }
  }, [selectedEp?.id, gogoAnimeId, pickedGogo, source]);

  const handlePickGogo = useCallback(
    (id: string) => {
      setUserPickedGogoId(id);
      setSelectedEp(null);
      if (source.mode === 'anilist') {
        replaceWatchUrl({ kind: 'al', alId: source.anime.id, kid: id });
      }
    },
    [source],
  );

  const handleEpisodeSelect = useCallback((ep: Episode) => {
    setSelectedEp(ep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePlaybackProgress = useCallback(
    (at: number, _dur: number) => {
      if (!selectedEp || !gogoAnimeId) return;
      saveContinue({
        mode: source.mode === 'anilist' ? 'al' : 'kai',
        kaiId: gogoAnimeId,
        alId: source.mode === 'anilist' ? source.anime.id : undefined,
        epId: selectedEp.id,
        epNum: selectedEp.number,
        title,
        cover: poster,
        at,
        updated: Date.now(),
      });
    },
    [selectedEp, gogoAnimeId, source, title, poster],
  );

  const episodes = mapConsumetEpisodes(infoQuery.data?.episodes);
  const currentIdx = episodes.findIndex((e) => e.id === selectedEp?.id);

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) handleEpisodeSelect(episodes[currentIdx - 1]);
  }, [currentIdx, episodes, handleEpisodeSelect]);

  const handleNext = useCallback(() => {
    if (currentIdx < episodes.length - 1) handleEpisodeSelect(episodes[currentIdx + 1]);
  }, [currentIdx, episodes, handleEpisodeSelect]);

  const isLoading =
    searchQuery.isLoading || (!!gogoAnimeId && infoQuery.isLoading && !infoQuery.data);

  const notFound =
    searchQuery.isError ||
    (searchQuery.isFetched && searchResults.length === 0) ||
    (!!gogoAnimeId && infoQuery.isError) ||
    (!!gogoAnimeId && infoQuery.isFetched && !infoQuery.isLoading && episodes.length === 0);

  if (showMatchPicker) {
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
            Multiple catalog entries matched. Choose the one that matches your show.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handlePickGogo(r.id)}
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
        {streamsLoading && (
          <div className="w-full aspect-video rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <p className="text-white/30 text-sm">Loading stream...</p>
          </div>
        )}

        {showEmbed && vidsrcEmbed && !streamsLoading && (
          <VideoPlayer embedSrc={vidsrcEmbed} poster={poster} />
        )}

        {!showEmbed && hasStream && !streamsLoading && streamQuery.data && (
          <VideoPlayer
            stream={streamQuery.data}
            poster={poster}
            directHls
            onPlaybackProgress={handlePlaybackProgress}
          />
        )}

        {streamQuery.isError && selectedEp && !streamsLoading && !showEmbed && (
          <div className="w-full aspect-video rounded-xl bg-white/5 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-white/40 text-sm text-center">Failed to load stream.</p>
            <button
              type="button"
              onClick={() => streamQuery.refetch()}
              className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!hasStream &&
          !streamsLoading &&
          !streamQuery.isError &&
          selectedEp &&
          !showEmbed &&
          streamQuery.isFetched && (
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
