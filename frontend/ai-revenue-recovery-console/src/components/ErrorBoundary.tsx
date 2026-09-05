import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Revly Dashboard Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('revly_api_mode');
        window.localStorage.removeItem('revly_api_url');
      }
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#090b0e] text-zinc-300 p-6">
          <div className="max-w-md w-full bg-[#0e121a] border border-[#222533] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Dashboard Recovery Mode</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred in the revenue recovery console.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold"
              >
                <RefreshCw size={14} />
                <span>Reset & Reload Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

