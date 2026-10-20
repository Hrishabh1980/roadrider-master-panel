import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log safe diagnostic information without exposing sensitive credentials or user data
    console.error('[ErrorBoundary] Caught unhandled component error:', error.message);
    if (errorInfo?.componentStack) {
      console.error('[ErrorBoundary] Component stack trace:', errorInfo.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.hash = 'dashboard';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto my-12">
          <div className="border border-red-200 bg-red-50/60 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-black mb-2">Something went wrong rendering this section</h2>
            <p className="text-xs text-[#666] mb-6 max-w-md mx-auto">
              {this.props.fallbackMessage || this.state.error?.message || 'An unexpected rendering error occurred. You can retry loading this view or return to the dashboard.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-[#333] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry View
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#E8E8E8] bg-white text-[#464646] text-xs font-bold rounded-xl hover:bg-[#F5F5F5] transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" /> Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
