interface GenreFilterProps {
  genres: string[];
  selected: string | null;
  onSelect: (genre: string | null) => void;
  isLoading?: boolean;
}

export const GenreFilter = ({ genres, selected, onSelect, isLoading }: GenreFilterProps) => {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-white/8 animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          selected === null
            ? 'bg-pink-400/90 text-white shadow-lg shadow-pink-500/25'
            : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80'
        }`}
      >
        All
      </button>
      {genres.map((g) => (
        <button
          key={g}
          onClick={() => onSelect(g === selected ? null : g)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            g === selected
              ? 'bg-pink-400/90 text-white shadow-lg shadow-pink-500/25'
              : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80'
          }`}
        >
          {g}
        </button>
      ))}
    </div>
  );
};
