import {
  Suspense,
  lazy,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  Component,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { QueryClient, QueryClientProvider, useQuery, useQueries } from '@tanstack/react-query';
import * as THREE from 'three';

import { AnimioMark } from './components/AnimioMark';
import { HeroOverlay } from './components/Overlay';
import { AnimeGrid } from './components/AnimeGrid';
import { AnimeModal } from './components/AnimeModal';
import { GenreFilter } from './components/GenreFilter';
import { SectionHeader } from './components/SectionHeader';
import { WatchPage, type WatchSource } from './components/WatchPage';
import { StreamAnimeGrid } from './components/StreamAnimeGrid';
import { ContinueWatching } from './components/ContinueWatching';
import { WatchlistStrip } from './components/WatchlistStrip';
import { MainErrorBoundary } from './components/MainErrorBoundary';
import { animeApi, type AnimeResult } from './lib/animeapi';
import {
  fetchTrending,
  fetchTopRated,
  searchAnime,
  fetchGenres,
  fetchAnimeDetail,
  type AniMedia,
} from './lib/anilist';
import { parseWatchFromSearch } from './lib/watchUrl';
import {
  getContinue,
  clearContinue,
  getWatchlist,
  addWatchlistEntry,
  removeWatchlistEntry,
  getReduceMotion,
  setReduceMotion as saveReduceMotionPref,
  type WatchlistEntry,
} from './lib/localStore';

const Scene = lazy(() => import('./components/Scene'));

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div className="absolute inset-0 bg-[#0B0C10]" />;
    }
    return this.props.children;
  }
}

function stripWatchSearchParams() {
  const u = new URL(window.location.href);
  ['watch', 'id', 'al', 'ep', 'kid'].forEach((k) => u.searchParams.delete(k));
  history.replaceState(history.state ?? {}, '', u);
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 2 } },
});

function AppContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [modalAnime, setModalAnime] = useState<AniMedia | null>(null);
  const [watchSource, setWatchSource] = useState<WatchSource | null>(null);
  const [watchBoot, setWatchBoot] = useState<{ epId?: string; kid?: string } | null>(null);
  const [watchlistVersion, setWatchlistVersion] = useState(0);
  const [continueEntry, setContinueEntry] = useState(() => getContinue());
  const [reduceMotion, setReduceMotionState] = useState(() => getReduceMotion());
  const [heroInView, setHeroInView] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const urlParsedRef = useRef(false);

  const watchlistEntries = useMemo(() => getWatchlist(), [watchlistVersion]);

  const alIds = useMemo(
    () =>
      watchlistEntries
        .filter((e): e is Extract<WatchlistEntry, { type: 'al' }> => e.type === 'al')
        .map((e) => e.id),
    [watchlistEntries],
  );

  const alDetailQueries = useQueries({
    queries: alIds.map((id) => ({
      queryKey: ['anilist-detail', id],
      queryFn: () => fetchAnimeDetail(id).then((r) => r.Media),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const resolvedAni = useMemo(() => {
    const m = new Map<number, AniMedia>();
    alIds.forEach((id, i) => {
      const d = alDetailQueries[i]?.data;
      if (d) m.set(id, d);
    });
    return m;
  }, [alIds, alDetailQueries]);

  const kaiMeta = useMemo(() => {
    const m = new Map<string, AnimeResult>();
    watchlistEntries.forEach((e) => {
      if (e.type === 'kai') {
        m.set(e.id, { id: e.id, title: e.title, image: e.image });
      }
    });
    return m;
  }, [watchlistEntries]);

  useEffect(() => {
    if (urlParsedRef.current) return;
    urlParsedRef.current = true;
    const p = parseWatchFromSearch();
    if (!p) return;
    let cancelled = false;
    (async () => {
      try {
        if (p.kind === 'kai') {
          const info = await animeApi.info(p.kaiId);
          if (cancelled) return;
          const ar: AnimeResult = {
            id: info.id,
            title: info.title,
            image: info.image,
            banner: info.description,
            genres: info.genres,
            episodes: info.episodes?.length,
          };
          setWatchSource({ mode: 'animekai', anime: ar });
          setWatchBoot({ epId: p.epId });
        } else {
          const { Media } = await fetchAnimeDetail(p.alId);
          if (cancelled) return;
          setWatchSource({ mode: 'anilist', anime: Media });
          setWatchBoot({ epId: p.epId, kid: p.kid });
        }
        history.replaceState({ ...(history.state ?? {}), watch: true }, '', window.location.href);
      } catch {
        if (cancelled) return;
        stripWatchSearchParams();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = heroSectionRef.current;
    if (!el || reduceMotion) return;
    const ob = new IntersectionObserver(
      ([e]) => setHeroInView(e.isIntersecting),
      { root: null, threshold: 0.05 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [reduceMotion]);

  const bumpWatchlist = useCallback(() => setWatchlistVersion((v) => v + 1), []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setWatchSource(null);
    setWatchBoot(null);
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handleCardClick = useCallback((anime: AniMedia) => {
    setModalAnime(anime);
    history.pushState({ modal: true }, '');
  }, []);

  const handleWatch = useCallback((anime: AniMedia) => {
    setWatchSource({ mode: 'anilist', anime });
    setWatchBoot(null);
    history.pushState({ watch: true }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStreamCardClick = useCallback((anime: AnimeResult) => {
    setWatchSource({ mode: 'animekai', anime });
    setWatchBoot(null);
    history.pushState({ watch: true }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleAddKaiWatchlist = useCallback(
    (anime: AnimeResult) => {
      addWatchlistEntry({ type: 'kai', id: anime.id, title: anime.title, image: anime.image });
      bumpWatchlist();
    },
    [bumpWatchlist],
  );

  const handleAddAniWatchlist = useCallback(
    (anime: AniMedia) => {
      addWatchlistEntry({ type: 'al', id: anime.id });
      bumpWatchlist();
    },
    [bumpWatchlist],
  );

  const handleBackFromWatch = useCallback(() => {
    setWatchSource(null);
    setWatchBoot(null);
    stripWatchSearchParams();
  }, []);

  const handleDismissContinue = useCallback(() => {
    clearContinue();
    setContinueEntry(null);
  }, []);

  const handleResumeContinue = useCallback(async () => {
    const cont = getContinue();
    if (!cont) return;
    try {
      if (cont.mode === 'al' && cont.alId != null) {
        const { Media } = await fetchAnimeDetail(cont.alId);
        setWatchSource({ mode: 'anilist', anime: Media });
        setWatchBoot({ epId: cont.epId, kid: cont.kaiId });
      } else {
        const info = await animeApi.info(cont.kaiId);
        const ar: AnimeResult = {
          id: info.id,
          title: info.title,
          image: info.image,
          banner: info.description,
          genres: info.genres,
          episodes: info.episodes?.length,
        };
        setWatchSource({ mode: 'animekai', anime: ar });
        setWatchBoot({ epId: cont.epId });
      }
      history.pushState({ watch: true }, '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      /* keep banner */
    }
  }, []);

  const toggleReduceMotion = useCallback(() => {
    setReduceMotionState((prev) => {
      const next = !prev;
      saveReduceMotionPref(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setWatchSource(null);
      setWatchBoot(null);
      setModalAnime(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const trending = useQuery({
    queryKey: ['trending'],
    queryFn: () => fetchTrending(1, 10),
  });

  const topRated = useQuery({
    queryKey: ['topRated', selectedGenre],
    queryFn: () => fetchTopRated(1, 20, selectedGenre ?? undefined),
  });

  const search = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => searchAnime(searchQuery),
    enabled: searchQuery.length > 0,
  });

  const genres = useQuery({
    queryKey: ['genres'],
    queryFn: fetchGenres,
    staleTime: Infinity,
  });

  const spotlight = useQuery({
    queryKey: ['consumet-top-airing'],
    queryFn: () => animeApi.topAiring(),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const filteredGenres = (genres.data?.GenreCollection ?? []).filter((g) => g !== 'Hentai');

  if (watchSource) {
    return (
      <WatchPage
        source={watchSource}
        onBack={handleBackFromWatch}
        initialEpisodeId={watchBoot?.epId ?? null}
        initialKaiOverrideId={watchBoot?.kid ?? null}
      />
    );
  }

  const showHeroCanvas = !reduceMotion && heroInView;

  return (
    <div className="relative w-full min-h-screen bg-[#0B0C10] text-white">
      <section ref={heroSectionRef} className="relative h-screen w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          {showHeroCanvas ? (
            <CanvasErrorBoundary>
              <Canvas
                camera={{ position: [0, -1, 14], fov: 50, near: 0.1, far: 200 }}
                dpr={[1, 2]}
                gl={{
                  antialias: true,
                  powerPreference: 'high-performance',
                  alpha: false,
                  stencil: false,
                  depth: true,
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1,
                  outputColorSpace: THREE.SRGBColorSpace,
                }}
              >
                <Suspense fallback={null}>
                  <Scene />
                </Suspense>
              </Canvas>
            </CanvasErrorBoundary>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a1525] via-[#12131c] to-[#0B0C10]" />
          )}
        </div>
        <HeroOverlay
          onSearch={handleSearch}
          reduceMotion={reduceMotion}
          onToggleReduceMotion={toggleReduceMotion}
        />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0B0C10] to-transparent z-10 pointer-events-none" />
      </section>

      <Loader
        containerStyles={{ background: 'rgba(11, 12, 16, 0.94)', zIndex: 40 }}
        innerStyles={{ width: 260 }}
        barStyles={{ height: 3, background: 'linear-gradient(90deg, #ffb7c5, #87ceeb)' }}
        dataStyles={{ color: '#e8e0f0', fontSize: '12px', letterSpacing: '0.2em' }}
      />

      <MainErrorBoundary>
        <main
          ref={contentRef}
          className="relative z-20 px-4 sm:px-8 md:px-12 lg:px-20 pb-20 space-y-16 max-w-7xl mx-auto -mt-16"
        >
          {!searchQuery && (
            <ContinueWatching
              entry={continueEntry}
              onResume={handleResumeContinue}
              onDismiss={handleDismissContinue}
            />
          )}

          {!searchQuery && watchlistEntries.length > 0 && (
            <WatchlistStrip
              entries={watchlistEntries}
              resolved={resolvedAni}
              kaiMeta={kaiMeta}
              onOpenAni={(m) => {
                setModalAnime(m);
                history.pushState({ modal: true }, '');
              }}
              onOpenKai={(a) => {
                setWatchSource({ mode: 'animekai', anime: a });
                setWatchBoot(null);
                history.pushState({ watch: true }, '');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRemove={(e) => {
                removeWatchlistEntry(e);
                bumpWatchlist();
              }}
            />
          )}

          {searchQuery && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <SectionHeader title="Results for" accent={`"${searchQuery}"`} />
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-white/40 hover:text-white/80 transition-colors"
                >
                  Clear
                </button>
              </div>
              <AnimeGrid
                anime={search.data?.Page.media ?? []}
                isLoading={search.isLoading}
                onCardClick={handleCardClick}
              />
            </section>
          )}

          {!searchQuery && (
            <>
              <section>
                <SectionHeader title="Top Airing" />
                {spotlight.isError && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] py-10 px-4 text-center">
                    <p className="text-white/45 text-sm mb-4">Could not load Top Airing. Try again.</p>
                    <button
                      type="button"
                      onClick={() => spotlight.refetch()}
                      className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!spotlight.isError && (
                  <StreamAnimeGrid
                    anime={spotlight.data?.results ?? []}
                    isLoading={spotlight.isLoading}
                    onCardClick={handleStreamCardClick}
                    onAddWatchlist={handleAddKaiWatchlist}
                  />
                )}
                {!spotlight.isLoading && !spotlight.isError && !(spotlight.data?.results?.length ?? 0) && (
                  <p className="text-white/35 text-sm py-6">No spotlight titles right now.</p>
                )}
              </section>

              <section>
                <SectionHeader title="Trending" accent="Now" />
                <AnimeGrid
                  anime={trending.data?.Page.media ?? []}
                  isLoading={trending.isLoading}
                  onCardClick={handleCardClick}
                />
              </section>

              <section>
                <SectionHeader title="Top Rated" accent={selectedGenre ?? ''} />
                <GenreFilter
                  genres={filteredGenres}
                  selected={selectedGenre}
                  onSelect={setSelectedGenre}
                  isLoading={genres.isLoading}
                />
                <div className="mt-6">
                  <AnimeGrid
                    anime={topRated.data?.Page.media ?? []}
                    isLoading={topRated.isLoading}
                    onCardClick={handleCardClick}
                  />
                </div>
              </section>
            </>
          )}
        </main>
      </MainErrorBoundary>

      <footer className="relative z-20 max-w-3xl mx-auto px-6 py-10 text-center text-white/30 text-xs leading-relaxed space-y-2">
        <div className="flex items-center justify-center gap-2.5">
          <AnimioMark size={28} className="shrink-0 opacity-90" />
          <p className="tracking-widest uppercase text-white/25">Animio</p>
        </div>
        <p>
          Episode metadata and listings come from public APIs; video streams are provided by third-party
          sources. This app does not host or upload video files.
        </p>
      </footer>

      <AnimeModal
        anime={modalAnime}
        onClose={() => {
          setModalAnime(null);
          if (history.state?.modal) history.back();
        }}
        onWatch={handleWatch}
        onAddToList={handleAddAniWatchlist}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
