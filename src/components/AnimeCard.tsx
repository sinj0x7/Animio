import type { AniMedia } from '../lib/anilist';

interface AnimeCardProps {
  anime: AniMedia;
  onClick: (anime: AniMedia) => void;
}

export const AnimeCard = ({ anime, onClick }: AnimeCardProps) => {
  const title = anime.title.english || anime.title.romaji;
  const score = anime.averageScore;
  const color = anime.coverImage.color ?? '#ffb7c5';

  return (
    <button
      onClick={() => onClick(anime)}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-black/30 border border-white/5 hover:border-white/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl text-left w-full"
    >
      {/* Cover image */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        {/* Score badge */}
        {score != null && (
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold backdrop-blur-md"
            style={{ backgroundColor: `${color}cc`, color: '#fff' }}
          >
            {(score / 10).toFixed(1)}
          </div>
        )}
        {/* Gradient fade at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-snug">
          {title}
        </h3>
        <div className="flex flex-wrap gap-1 mt-auto">
          {anime.genres.slice(0, 2).map((g) => (
            <span
              key={g}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-medium"
            >
              {g}
            </span>
          ))}
          {anime.episodes != null && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-medium">
              {anime.episodes} ep
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
