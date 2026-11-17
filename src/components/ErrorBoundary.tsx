import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        readable = `Database ${parsed.operationType ?? 'operation'} failed: ${parsed.error}`;
      }
    } catch {
      // Keep original error message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFF9FB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-pink-200 rounded-2xl p-8">
            <h1 className="text-xl font-semibold text-[#831843]">Something went wrong</h1>
            <p className="mt-2 text-sm text-pink-900/75 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-[44px] px-4 py-2.5 bg-[#BE185D] text-white text-sm font-semibold rounded-xl hover:bg-[#9D174D] transition-colors cursor-pointer"
            >
              Reload Openline Court
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
