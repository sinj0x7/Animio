import type { AniMedia } from '../lib/anilist';
import { AnimeCard } from './AnimeCard';

interface AnimeGridProps {
  anime: AniMedia[];
  isLoading?: boolean;
  onCardClick: (anime: AniMedia) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-white/5 animate-pulse">
      <div className="aspect-[3/4] bg-white/10" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

export const AnimeGrid = ({ anime, isLoading, onCardClick }: AnimeGridProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!anime.length) {
    return (
      <p className="text-white/40 text-center py-12 text-lg font-light">
        No anime found.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {anime.map((a) => (
        <AnimeCard key={a.id} anime={a} onClick={onCardClick} />
      ))}
    </div>
  );
};
