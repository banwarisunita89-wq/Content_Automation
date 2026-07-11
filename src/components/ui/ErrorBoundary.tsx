import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0B0C10' }}>
          <div className="glass-panel p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-ink-50 mb-2">System Recovered From Error</h2>
            <p className="text-xs text-ink-400 mb-6">
              The application encountered an unexpected error and recovered automatically.
              Your data is safe. You can continue working.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 rounded-xl font-medium text-sm text-black transition-all"
              style={{ background: 'var(--accent, #00d4ff)' }}
            >
              Resume Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
