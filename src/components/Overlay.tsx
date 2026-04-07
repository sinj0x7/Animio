import { AnimioMark } from './AnimioMark';
import { SearchBar } from './SearchBar';

interface HeroOverlayProps {
  onSearch: (query: string) => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
}

export const HeroOverlay = ({ onSearch, reduceMotion, onToggleReduceMotion }: HeroOverlayProps) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8">
        <AnimioMark
          size={36}
          title="Animio"
          className="opacity-90 drop-shadow-[0_0_18px_rgba(255,183,197,0.28)] sm:h-10 sm:w-10"
        />
      </div>
      <div className="pointer-events-auto absolute top-4 right-4 sm:top-6 sm:right-8">
        <button
          type="button"
          onClick={onToggleReduceMotion}
          className="text-[10px] sm:text-xs uppercase tracking-widest text-white/35 hover:text-white/60 transition-colors"
        >
          {reduceMotion ? 'Enable hero motion' : 'Reduce motion'}
        </button>
      </div>
      <div className="pointer-events-auto text-center flex flex-col items-center gap-6 w-full">
        <p className="text-xs sm:text-sm tracking-[0.4em] text-pink-300/50 uppercase">
          Discover your next favorite
        </p>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white drop-shadow-[0_0_30px_rgba(255,183,197,0.4)]">
          Anim<span className="text-pink-300">io</span>
        </h1>
        <p className="text-white/50 text-sm sm:text-base font-light max-w-md px-4">
          Browse trending shows, search by title, and explore every genre.
        </p>
        <SearchBar onSearch={onSearch} />
        <div className="mt-8 opacity-40 text-xs tracking-[0.2em] uppercase text-white/40 animate-bounce">
          Scroll down
        </div>
      </div>
    </div>
  );
};
