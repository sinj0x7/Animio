import { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) onSearch(trimmed);
    },
    [value, onSearch],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto px-4">
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-pink-400/30 via-purple-400/30 to-sky-400/30 blur-sm opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-5 py-3">
          <svg
            className="w-5 h-5 text-white/40 mr-3 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search anime... (e.g. Attack on Titan)"
            className="flex-1 bg-transparent text-white text-base sm:text-lg placeholder-white/30 outline-none font-light tracking-wide"
          />
          <button
            type="submit"
            className="ml-3 px-5 py-1.5 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-colors duration-200 shrink-0"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
};
