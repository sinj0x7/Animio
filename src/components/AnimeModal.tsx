import { useEffect, useRef } from 'react';
import type { AniMedia } from '../lib/anilist';

interface AnimeModalProps {
  anime: AniMedia | null;
  onClose: () => void;
  onWatch?: (anime: AniMedia) => void;
  onAddToList?: (anime: AniMedia) => void;
}

function stripHtml(html: string) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? '';
}

export const AnimeModal = ({ anime, onClose, onWatch, onAddToList }: AnimeModalProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anime) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [anime, onClose]);

  if (!anime) return null;

  const title = anime.title.english || anime.title.romaji;
  const studio = anime.studios.nodes[0]?.name;
  const score = anime.averageScore;
  const desc = anime.description ? stripHtml(anime.description) : null;
  const color = anime.coverImage.color ?? '#ffb7c5';
  const trailerUrl =
    anime.trailer?.site === 'youtube'
      ? `https://www.youtube.com/watch?v=${anime.trailer.id}`
      : null;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1018]/95 backdrop-blur-xl shadow-2xl">
        {/* Banner */}
        {anime.bannerImage && (
          <div className="h-44 sm:h-56 overflow-hidden relative">
            <img
              src={anime.bannerImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1018] via-transparent to-transparent" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white hover:bg-black/70 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
          {/* Cover */}
          <img
            src={anime.coverImage.extraLarge || anime.coverImage.large}
            alt={title}
            className="w-36 sm:w-44 aspect-[3/4] rounded-xl object-cover shrink-0 shadow-xl self-start -mt-16 sm:-mt-20 relative z-10 border-2"
            style={{ borderColor: color }}
          />

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 leading-tight">{title}</h2>
            {anime.title.romaji !== title && (
              <p className="text-sm text-white/40 mb-3">{anime.title.romaji}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              {score != null && (
                <span
                  className="px-2.5 py-0.5 rounded-lg font-bold text-white"
                  style={{ backgroundColor: `${color}cc` }}
                >
                  {(score / 10).toFixed(1)}
                </span>
              )}
              {studio && <span className="text-white/50">{studio}</span>}
              {anime.format && <span className="text-white/40">{anime.format}</span>}
              {anime.episodes != null && (
                <span className="text-white/40">{anime.episodes} episodes</span>
              )}
              {anime.seasonYear && (
                <span className="text-white/40">
                  {anime.season} {anime.seasonYear}
                </span>
              )}
              {anime.status && (
                <span className="text-white/40">{anime.status}</span>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {anime.genres.map((g) => (
                <span
                  key={g}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/8 text-white/60"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Description */}
            {desc && (
              <p className="text-sm text-white/60 leading-relaxed line-clamp-6 mb-4">{desc}</p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {onWatch && (
                <button
                  onClick={() => { onWatch(anime); onClose(); }}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pink-500/80 text-white text-sm font-medium hover:bg-pink-500 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Watch Now
                </button>
              )}
              {onAddToList && (
                <button
                  type="button"
                  onClick={() => onAddToList(anime)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Add to list
                </button>
              )}
              <a
                href={anime.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                View on AniList
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              {trailerUrl && (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Watch Trailer
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
