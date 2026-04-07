import type { AnimeResult } from '../lib/animeapi';
import { StreamAnimeCard } from './StreamAnimeCard';

interface StreamAnimeGridProps {
  anime: AnimeResult[];
  isLoading?: boolean;
  onCardClick: (anime: AnimeResult) => void;
  onAddWatchlist?: (anime: AnimeResult) => void;
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

export const StreamAnimeGrid = ({ anime, isLoading, onCardClick, onAddWatchlist }: StreamAnimeGridProps) => {
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
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {anime.map((a) => (
        <StreamAnimeCard key={a.id} anime={a} onClick={onCardClick} onAddWatchlist={onAddWatchlist} />
      ))}
    </div>
  );
};
