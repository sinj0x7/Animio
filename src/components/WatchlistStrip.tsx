import type { AniMedia } from '../lib/anilist';
import type { AnimeResult } from '../lib/animeapi';
import type { WatchlistEntry } from '../lib/localStore';

interface WatchlistStripProps {
  entries: WatchlistEntry[];
  resolved: Map<number, AniMedia>;
  kaiMeta: Map<string, AnimeResult>;
  onOpenAni: (anime: AniMedia) => void;
  onOpenKai: (anime: AnimeResult) => void;
  onRemove: (e: WatchlistEntry) => void;
}

export const WatchlistStrip = ({
  entries,
  resolved,
  kaiMeta,
  onOpenAni,
  onOpenKai,
  onRemove,
}: WatchlistStripProps) => {
  if (!entries.length) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Your list</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
        {entries.map((e) => {
          if (e.type === 'al') {
            const m = resolved.get(e.id);
            if (!m) {
              return (
                <div
                  key={`al-${e.id}`}
                  className="shrink-0 w-28 h-40 rounded-xl bg-white/5 animate-pulse"
                />
              );
            }
            const title = m.title.english || m.title.romaji;
            return (
              <div key={`al-${e.id}`} className="shrink-0 relative group w-28">
                <button
                  type="button"
                  onClick={() => onOpenAni(m)}
                  className="w-full text-left rounded-xl overflow-hidden border border-white/10 hover:border-pink-400/40 transition-colors"
                >
                  <img
                    src={m.coverImage.large}
                    alt=""
                    className="w-full aspect-[3/4] object-cover"
                  />
                  <p className="p-2 text-[11px] text-white/80 line-clamp-2 leading-tight">{title}</p>
                </button>
                <button
                  type="button"
                  aria-label="Remove from list"
                  onClick={() => onRemove(e)}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white/70 text-xs opacity-0 group-hover:opacity-100 hover:text-white"
                >
                  ×
                </button>
              </div>
            );
          }
          const k = kaiMeta.get(e.id) ?? e;
          return (
            <div key={`kai-${e.id}`} className="shrink-0 relative group w-28">
              <button
                type="button"
                onClick={() => onOpenKai(k as AnimeResult)}
                className="w-full text-left rounded-xl overflow-hidden border border-white/10 hover:border-pink-400/40 transition-colors"
              >
                <img
                  src={k.image}
                  alt=""
                  className="w-full aspect-[3/4] object-cover"
                />
                <p className="p-2 text-[11px] text-white/80 line-clamp-2 leading-tight">{k.title}</p>
              </button>
              <button
                type="button"
                aria-label="Remove from list"
                onClick={() => onRemove(e)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white/70 text-xs opacity-0 group-hover:opacity-100 hover:text-white"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
