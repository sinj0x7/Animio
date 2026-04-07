import type { ContinueEntry } from '../lib/localStore';

interface ContinueWatchingProps {
  entry: ContinueEntry | null;
  onResume: () => void;
  onDismiss: () => void;
}

export const ContinueWatching = ({ entry, onResume, onDismiss }: ContinueWatchingProps) => {
  if (!entry) return null;

  return (
    <section className="rounded-2xl border border-pink-400/20 bg-gradient-to-r from-pink-500/10 to-sky-500/10 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <img
          src={entry.cover || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
          alt=""
          className="w-full sm:w-28 aspect-video sm:aspect-[3/4] rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-pink-300/70 mb-1">Continue watching</p>
          <h3 className="font-semibold text-white truncate">{entry.title}</h3>
          <p className="text-sm text-white/50 mt-0.5">
            Episode {entry.epNum}
            {entry.at > 15
              ? ` · resume from ${Math.floor(entry.at / 60)}:${String(Math.floor(entry.at % 60)).padStart(2, '0')}`
              : ''}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onResume}
            className="px-5 py-2.5 rounded-xl bg-pink-500/90 text-white text-sm font-medium hover:bg-pink-500 transition-colors"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/15"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
};
