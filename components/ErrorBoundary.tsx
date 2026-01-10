import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly declare props to satisfy strict TypeScript environments if inheritance inference fails
  declare props: Readonly<Props>;

  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CRITICAL] Uncaught error:', error, errorInfo);
    // In a real app, send to Sentry/LogRocket here
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md text-center border-t-4 border-red-600">
            <div className="bg-red-50 p-4 rounded-full inline-flex mb-6">
               <ShieldAlert className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">System Protection Active</h1>
            <p className="text-gray-600 mb-6">
              A critical exception was caught. The application has been halted to prevent data corruption.
            </p>
            
            <div className="bg-gray-100 p-4 rounded-lg text-left text-xs font-mono text-red-800 mb-6 overflow-auto max-h-32 border border-gray-200">
               <strong>Error:</strong> {this.state.error?.message}
            </div>

            <button
              className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-black transition-colors flex items-center justify-center w-full shadow-lg"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Reload System
            </button>
            <p className="text-xs text-gray-400 mt-4">
               If this persists, contact IT Support with the error message above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}