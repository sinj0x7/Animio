import type { AnimeResult } from '../lib/animeapi';

interface StreamAnimeCardProps {
  anime: AnimeResult;
  onClick: (anime: AnimeResult) => void;
  onAddWatchlist?: (anime: AnimeResult) => void;
}

export const StreamAnimeCard = ({ anime, onClick, onAddWatchlist }: StreamAnimeCardProps) => {
  const epCount = anime.episodes ?? anime.sub ?? anime.dub;
  const img = anime.image ?? anime.banner;

  return (
    <div className="group relative flex flex-col rounded-xl overflow-hidden bg-black/30 border border-white/5 hover:border-pink-400/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl w-full">
      {onAddWatchlist && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddWatchlist(anime);
          }}
          className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-pink-300/90 hover:bg-pink-500/40 hover:text-white text-lg leading-none"
          title="Add to list"
        >
          +
        </button>
      )}
      <button
        type="button"
        onClick={() => onClick(anime)}
        className="flex flex-col flex-1 text-left w-full min-h-0"
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={img}
            alt={anime.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          {epCount != null && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold backdrop-blur-md bg-pink-500/90 text-white">
              {epCount} ep
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        <div className="p-3 flex flex-col gap-1.5 flex-1">
          <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-snug">
            {anime.title}
          </h3>
          <div className="flex flex-wrap gap-1 mt-auto">
            {anime.genres?.slice(0, 2).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-medium">
                {g}
              </span>
            ))}
            {anime.type && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-medium">
                {anime.type}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};
