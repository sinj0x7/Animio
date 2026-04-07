import type { Episode } from '../lib/animeapi';

interface EpisodeListProps {
  episodes: Episode[];
  currentEpisode: string | null;
  onSelect: (episode: Episode) => void;
  isLoading?: boolean;
}

export const EpisodeList = ({ episodes, currentEpisode, onSelect, isLoading }: EpisodeListProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!episodes.length) {
    return <p className="text-white/40 text-sm py-4">No episodes available.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
      {episodes.map((ep) => {
        const isCurrent = ep.id === currentEpisode;
        return (
          <button
            key={ep.id}
            onClick={() => onSelect(ep)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 ${
              isCurrent
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                : 'bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span className={`text-sm font-bold tabular-nums shrink-0 w-8 ${isCurrent ? 'text-white' : 'text-white/40'}`}>
              {ep.number}
            </span>
            <span className="text-sm truncate flex-1">
              {ep.title || `Episode ${ep.number}`}
            </span>
            <div className="flex gap-1 shrink-0">
              {ep.isSubbed && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isCurrent ? 'bg-white/20' : 'bg-white/8 text-white/40'}`}>
                  SUB
                </span>
              )}
              {ep.isDubbed && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isCurrent ? 'bg-white/20' : 'bg-white/8 text-white/40'}`}>
                  DUB
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
