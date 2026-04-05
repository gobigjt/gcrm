import { Component } from 'react';

/**
 * Surfaces render errors instead of a blank root (common when a route throws).
 */
export default class ErrorBoundary extends Component {
  state = { err: null };

  static getDerivedStateFromError(err) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f6fa] dark:bg-[#0d0f1a] px-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
            {this.state.err?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-[#534ab7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3c3489]"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
