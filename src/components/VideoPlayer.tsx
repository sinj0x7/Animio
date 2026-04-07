import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Hls from 'hls.js';
import { hlsProxyUrl, type StreamData } from '../lib/animeapi';
import { getPrefs, savePrefs } from '../lib/localStore';

interface VideoPlayerProps {
  /** Consumet / proxy stream; omit when using embedSrc */
  stream?: StreamData | null;
  /** vidsrc.to (or other) iframe fallback */
  embedSrc?: string | null;
  poster?: string;
  /** Load HLS from origin URLs without /api/hls proxy (public CDN) */
  directHls?: boolean;
  onPlaybackProgress?: (currentTime: number, duration: number) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const VideoPlayer = ({
  stream,
  embedSrc,
  poster,
  directHls = false,
  onPlaybackProgress,
}: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressEmit = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [hlsLevelUi, setHlsLevelUi] = useState(-1);
  const [hlsHeightOptions, setHlsHeightOptions] = useState<{ level: number; label: string }[]>([]);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(() => getPrefs().playbackRate);

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [captionLabels, setCaptionLabels] = useState<{ idx: number; label: string }[]>([]);
  const [activeCaption, setActiveCaption] = useState(-1);

  const sources = stream?.sources?.filter((s) => s.url) ?? [];
  const currentSource = sources[sourceIdx] ?? null;
  const referer = stream?.headers?.Referer;

  const tryNextSource = useCallback(() => {
    if (sourceIdx < sources.length - 1) {
      const next = sourceIdx + 1;
      setSourceIdx(next);
      savePrefs({ streamSourceIdx: next });
      setError(null);
      setLoading(true);
    } else {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      setLoading(false);
      setError('All stream sources failed. Try a different episode.');
    }
  }, [sourceIdx, sources.length]);

  useEffect(() => {
    const n = sources.length;
    const p = getPrefs();
    setSourceIdx(n ? Math.min(p.streamSourceIdx, n - 1) : 0);
    setError(null);
    setLoading(true);
  }, [stream, sources.length]);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 3200);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource) return;

    setError(null);
    setLoading(true);
    setHlsHeightOptions([]);
    setHlsLevelUi(-1);
    setCaptionLabels([]);
    setActiveCaption(-1);
    setShowSpeedMenu(false);
    setShowQualityMenu(false);
    setShowSubMenu(false);

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute('src');
    video.load();
    video.querySelectorAll('track').forEach((t) => t.remove());

    if (poster) video.setAttribute('poster', poster);
    else video.removeAttribute('poster');

    const prefs = getPrefs();
    video.volume = prefs.volume;
    video.playbackRate = prefs.playbackRate;
    setPlaybackRateState(prefs.playbackRate);
    setVolume(prefs.volume);
    setMuted(false);

    const url = currentSource.url;
    const isHls = currentSource.isM3U8 || url.includes('.m3u8');
    const proxiedOrDirect = (u: string) => (directHls ? u : hlsProxyUrl(u, referer));

    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      savePrefs({ volume: video.volume });
    };
    const onRate = () => {
      setPlaybackRateState(video.playbackRate);
      savePrefs({ playbackRate: video.playbackRate });
    };
    const onTime = () => {
      if (!seeking) setCurrentTime(video.currentTime);
      if (onPlaybackProgress && video.duration > 0) {
        const now = Date.now();
        if (now - lastProgressEmit.current > 4000) {
          lastProgressEmit.current = now;
          onPlaybackProgress(video.currentTime, video.duration);
        }
      }
    };
    const onDur = () => setDuration(video.duration);
    const onProg = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onPlay = () => {
      setPlaying(true);
      bumpControls();
    };
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
    };

    video.addEventListener('volumechange', onVol);
    video.addEventListener('ratechange', onRate);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('progress', onProg);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    if (isHls && Hls.isSupported()) {
      const loadUrl = proxiedOrDirect(url);
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        xhrSetup(xhr, reqUrl) {
          const finalUrl =
            directHls || reqUrl.includes('/api/hls?url=')
              ? reqUrl
              : hlsProxyUrl(reqUrl, referer);
          xhr.open('GET', finalUrl, true);
        },
      });

      let fatalRetries = 0;

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);
        const byH = new Map<number, number>();
        data.levels.forEach((l, i) => {
          if (l.height > 0 && !byH.has(l.height)) byH.set(l.height, i);
        });
        const opts = [...byH.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([h, level]) => ({ level, label: `${h}p` }));
        setHlsHeightOptions(opts);

        if (prefs.hlsQualityLevel >= 0 && prefs.hlsQualityLevel < hls.levels.length) {
          hls.currentLevel = prefs.hlsQualityLevel;
          setHlsLevelUi(prefs.hlsQualityLevel);
        } else {
          hls.currentLevel = -1;
          setHlsLevelUi(-1);
        }
        video.volume = prefs.volume;
        video.playbackRate = prefs.playbackRate;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => {
        if (hls.autoLevelEnabled) {
          setHlsLevelUi(-1);
          return;
        }
        setHlsLevelUi(d.level);
        if (d.level >= 0) savePrefs({ hlsQualityLevel: d.level });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        fatalRetries++;
        if (fatalRetries <= 2) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
        }
        hls.destroy();
        hlsRef.current = null;
        tryNextSource();
      });

      hls.loadSource(loadUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxiedOrDirect(url);
      video.addEventListener(
        'loadedmetadata',
        () => {
          setLoading(false);
          video.play().catch(() => {});
        },
        { once: true },
      );
      video.addEventListener('error', () => tryNextSource(), { once: true });
    } else if (!isHls) {
      video.src = url;
      video.addEventListener(
        'loadedmetadata',
        () => {
          setLoading(false);
          video.play().catch(() => {});
        },
        { once: true },
      );
      video.addEventListener('error', () => tryNextSource(), { once: true });
    } else {
      setError('HLS is not supported in this browser.');
      setLoading(false);
    }

    const subs = stream?.subtitles?.filter((s) => s.kind === 'captions') ?? [];
    const blobUrls: string[] = [];
    let cancelled = false;
    const capLabels: { idx: number; label: string }[] = [];

    (async () => {
      for (let i = 0; i < subs.length; i++) {
        if (cancelled) return;
        const sub = subs[i];
        try {
          const subUrl = directHls ? sub.url : hlsProxyUrl(sub.url, referer);
          const resp = await fetch(subUrl);
          if (!resp.ok) continue;
          const blob = new Blob([await resp.arrayBuffer()], { type: 'text/vtt' });
          const blobUrl = URL.createObjectURL(blob);
          blobUrls.push(blobUrl);
          if (cancelled) {
            URL.revokeObjectURL(blobUrl);
            return;
          }
          const v = videoRef.current;
          if (!v) return;
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = sub.lang.trim();
          track.srclang = sub.lang.replace(/[^a-zA-Z-]/g, '').slice(0, 5).toLowerCase() || 'en';
          track.src = blobUrl;
          if (i === 0) track.default = true;
          v.appendChild(track);
          capLabels.push({ idx: capLabels.length, label: sub.lang.trim() });
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        setCaptionLabels(capLabels);
        if (capLabels.length > 0) {
          setActiveCaption(0);
          const v = videoRef.current;
          if (v) {
            for (let j = 0; j < v.textTracks.length; j++) {
              v.textTracks[j].mode = j === 0 ? 'showing' : 'hidden';
            }
          }
        } else setActiveCaption(-1);
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('progress', onProg);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      blobUrls.forEach((u) => URL.revokeObjectURL(u));
      video.querySelectorAll('track').forEach((t) => t.remove());
      video.removeAttribute('src');
      video.load();
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [currentSource, poster, referer, stream?.subtitles, tryNextSource, onPlaybackProgress, bumpControls, directHls]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!showSpeedMenu && !showQualityMenu && !showSubMenu) return;
    const close = (e: Event) => {
      if (!(e.target as HTMLElement).closest('.animio-player-menu')) {
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
        setShowSubMenu(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showSpeedMenu, showQualityMenu, showSubMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          bumpControls();
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          bumpControls();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          bumpControls();
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          bumpControls();
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          bumpControls();
          break;
        case 'f':
          e.preventDefault();
          {
            const el = containerRef.current;
            if (el) {
              if (document.fullscreenElement) document.exitFullscreen();
              else el.requestFullscreen();
            }
          }
          bumpControls();
          break;
        case 'm':
          e.preventDefault();
          v.muted = !v.muted;
          bumpControls();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bumpControls]);

  if (embedSrc) {
    return (
      <div className="space-y-3">
        <div className="relative w-full overflow-hidden rounded-xl bg-[#08090e] shadow-[0_0_48px_-12px_rgba(255,183,197,0.22)] ring-1 ring-pink-300/15 aspect-video">
          <iframe
            title="Embedded video"
            src={embedSrc}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          />
        </div>
      </div>
    );
  }

  if (!sources.length) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/80 text-white/50 text-sm">
        No stream available — try a different episode.
      </div>
    );
  }

  const pickHlsQuality = (level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (level < 0) {
      hls.currentLevel = -1;
      savePrefs({ hlsQualityLevel: -1 });
      setHlsLevelUi(-1);
    } else {
      hls.currentLevel = level;
      savePrefs({ hlsQualityLevel: level });
      setHlsLevelUi(level);
    }
    setShowQualityMenu(false);
    bumpControls();
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
    bumpControls();
  };

  const skip = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sec));
    bumpControls();
  };

  const toggleFs = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
    bumpControls();
  };

  const onProgressClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    setCurrentTime(pct * duration);
    bumpControls();
  };

  const onVolumeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    if (val > 0) v.muted = false;
    savePrefs({ volume: val });
    bumpControls();
  };

  const setSpeed = (r: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    setPlaybackRateState(r);
    savePrefs({ playbackRate: r });
    setShowSpeedMenu(false);
    bumpControls();
  };

  const setCaption = (idx: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (idx < 0) {
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = 'hidden';
      setActiveCaption(-1);
    } else {
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = i === idx ? 'showing' : 'hidden';
      }
      setActiveCaption(idx);
    }
    setShowSubMenu(false);
    bumpControls();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const qualityLabel =
    hlsLevelUi < 0
      ? 'Auto'
      : hlsHeightOptions.find((q) => q.level === hlsLevelUi)?.label ?? 'Auto';

  const menuBtn =
    'rounded-md p-1.5 text-white/65 hover:text-[var(--color-accent)] hover:bg-white/[0.06] transition-colors';

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="animio-player group relative w-full overflow-hidden rounded-xl bg-[#08090e] shadow-[0_0_48px_-12px_rgba(255,183,197,0.22)] ring-1 ring-pink-300/15 select-none"
        onMouseMove={bumpControls}
        onMouseLeave={() => {
          if (playing) setControlsVisible(false);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.animio-player-ui, .animio-player-menu')) return;
          togglePlay();
          bumpControls();
        }}
      >
        <video
          ref={videoRef}
          className="aspect-video h-full w-full cursor-pointer bg-black"
          playsInline
          preload="metadata"
        />

        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#06070b]/80">
            <div
              className="h-11 w-11 rounded-full border-2 border-[var(--color-accent)]/35 border-t-[var(--color-accent)] animate-spin"
              aria-hidden
            />
            <p className="mt-4 font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.35em] text-pink-200/45">
              Loading
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#06070b]/92 px-6 text-center">
            <p className="text-sm text-white/55">{error}</p>
            {sourceIdx > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSourceIdx(0);
                  setError(null);
                  setLoading(true);
                  savePrefs({ streamSourceIdx: 0 });
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                Retry first source
              </button>
            )}
          </div>
        )}

        {!loading && !error && !playing && controlsVisible && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent2)] shadow-lg shadow-pink-500/25">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#0b0c10" className="ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        <div
          className={`animio-player-ui absolute inset-x-0 bottom-0 z-10 transition-opacity duration-300 ${
            controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-[#06070b]/98 via-[#06070b]/75 to-transparent px-3 pb-2 pt-14 sm:px-4">
            <div
              ref={progressRef}
              role="slider"
              tabIndex={0}
              aria-valuenow={Math.round(progress)}
              className="relative mb-3 flex h-5 cursor-pointer items-center"
              onClick={onProgressClick}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onKeyDown={(e) => {
                const v = videoRef.current;
                if (!v) return;
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  v.currentTime = Math.min(v.duration, v.currentTime + 5);
                }
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  v.currentTime = Math.max(0, v.currentTime - 5);
                }
              }}
            >
              <div className="relative h-[3px] w-full rounded-full bg-white/[0.08] transition-[height] group-hover:h-[5px]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-sky-400/25"
                  style={{ width: `${bufferPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent2)]"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-0 shadow-[0_0_10px_rgba(255,183,197,0.5)] transition-opacity group-hover:opacity-100"
                  style={{ left: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => togglePlay()}
                className={menuBtn}
                title={playing ? 'Pause (k)' : 'Play (k)'}
              >
                {playing ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>

              <button type="button" onClick={() => skip(-10)} className={menuBtn} title="Back 10s">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11.5 2a10 10 0 1 1-6.7 2.8L2 2" />
                    <polyline points="2 7 2 2 7 2" />
                  </svg>
                  <span className="absolute text-[8px] font-bold">10</span>
                </span>
              </button>

              <button type="button" onClick={() => skip(10)} className={menuBtn} title="Forward 10s">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12.5 2a10 10 0 1 0 6.7 2.8L22 2" />
                    <polyline points="22 7 22 2 17 2" />
                  </svg>
                  <span className="absolute text-[8px] font-bold">10</span>
                </span>
              </button>

              <div className="flex items-center gap-1 pl-1">
                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (v) v.muted = !v.muted;
                    bumpControls();
                  }}
                  className={menuBtn}
                  title="Mute (m)"
                >
                  {muted || volume === 0 ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={onVolumeInput}
                  onClick={(e) => e.stopPropagation()}
                  className="animio-vol-slider hidden h-1 w-0 min-w-[52px] sm:block sm:w-16"
                  style={{ '--vol': `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                />
              </div>

              <span className="ml-1 hidden font-mono text-[11px] tabular-nums text-white/45 sm:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="ml-auto flex items-center gap-0.5">
                {captionLabels.length > 0 && (
                  <div className="relative animio-player-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubMenu((x) => !x);
                        setShowSpeedMenu(false);
                        setShowQualityMenu(false);
                      }}
                      className={`${menuBtn} ${activeCaption >= 0 ? 'text-[var(--color-accent)]' : ''}`}
                      title="Captions"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M6 8h12M6 12h8" />
                      </svg>
                    </button>
                    {showSubMenu && (
                      <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg border border-pink-300/15 bg-[#0f1018]/98 py-1 shadow-xl backdrop-blur-md">
                        <p className="px-3 py-1.5 font-[family-name:var(--font-display)] text-[9px] uppercase tracking-widest text-pink-200/40">
                          Subtitles
                        </p>
                        <button
                          type="button"
                          onClick={() => setCaption(-1)}
                          className={`block w-full px-3 py-2 text-left text-xs ${activeCaption < 0 ? 'text-[var(--color-accent)]' : 'text-white/65 hover:bg-white/5'}`}
                        >
                          Off
                        </button>
                        {captionLabels.map((c) => (
                          <button
                            key={c.idx}
                            type="button"
                            onClick={() => setCaption(c.idx)}
                            className={`block w-full px-3 py-2 text-left text-xs ${activeCaption === c.idx ? 'text-[var(--color-accent)]' : 'text-white/65 hover:bg-white/5'}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {hlsHeightOptions.length > 1 && Hls.isSupported() && (
                  <div className="relative animio-player-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setShowQualityMenu((x) => !x);
                        setShowSpeedMenu(false);
                        setShowSubMenu(false);
                      }}
                      className={`${menuBtn} min-w-[3rem] text-[11px] font-semibold tabular-nums`}
                      title="Quality"
                    >
                      {qualityLabel}
                    </button>
                    {showQualityMenu && (
                      <div className="absolute bottom-full right-0 mb-2 min-w-[120px] rounded-lg border border-pink-300/15 bg-[#0f1018]/98 py-1 shadow-xl backdrop-blur-md">
                        <p className="px-3 py-1.5 font-[family-name:var(--font-display)] text-[9px] uppercase tracking-widest text-pink-200/40">
                          Quality
                        </p>
                        <button
                          type="button"
                          onClick={() => pickHlsQuality(-1)}
                          className={`block w-full px-3 py-2 text-left text-xs ${hlsLevelUi === -1 ? 'text-[var(--color-accent)]' : 'text-white/65 hover:bg-white/5'}`}
                        >
                          Auto
                        </button>
                        {hlsHeightOptions.map((q) => (
                          <button
                            key={q.level}
                            type="button"
                            onClick={() => pickHlsQuality(q.level)}
                            className={`block w-full px-3 py-2 text-left text-xs ${hlsLevelUi === q.level ? 'text-[var(--color-accent)]' : 'text-white/65 hover:bg-white/5'}`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="relative animio-player-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeedMenu((x) => !x);
                      setShowQualityMenu(false);
                      setShowSubMenu(false);
                    }}
                    className={`${menuBtn} text-[11px] font-semibold tabular-nums min-w-[2.25rem]`}
                    title="Speed"
                  >
                    {playbackRate === 1 ? '1×' : `${playbackRate}×`}
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 min-w-[100px] rounded-lg border border-pink-300/15 bg-[#0f1018]/98 py-1 shadow-xl backdrop-blur-md">
                      <p className="px-3 py-1.5 font-[family-name:var(--font-display)] text-[9px] uppercase tracking-widest text-pink-200/40">
                        Speed
                      </p>
                      {SPEEDS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSpeed(r)}
                          className={`block w-full px-3 py-2 text-left text-xs ${playbackRate === r ? 'text-[var(--color-accent)]' : 'text-white/65 hover:bg-white/5'}`}
                        >
                          {r}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => toggleFs()} className={menuBtn} title="Fullscreen (f)">
                  {isFullscreen ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {sources.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-pink-200/35">
            Source
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSourceIdx(i);
                  setError(null);
                  setLoading(true);
                  savePrefs({ streamSourceIdx: i });
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === sourceIdx
                    ? 'border-pink-400/40 bg-pink-500/15 text-pink-100'
                    : 'border-white/10 bg-white/[0.04] text-white/45 hover:border-white/20 hover:text-white/75'
                }`}
              >
                {s.quality || `Source ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
