import { Component, type ReactNode } from 'react';

export class MainErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-6 text-center text-white/70">
          <p className="text-sm">Something went wrong loading this section.</p>
          <button
            type="button"
            onClick={() => this.setState({ err: null })}
            className="px-4 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
