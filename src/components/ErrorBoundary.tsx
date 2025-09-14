import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next'; // ADDED

interface Props {
  children?: ReactNode;
  fallback?: ReactNode; // Optional fallback UI
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  // This lifecycle method is called after an error has been thrown by a descendant component.
  static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: null, errorInfo: null }; // error and errorInfo will be set in componentDidCatch
  }

  // This lifecycle method is called after an error has been thrown by a descendant component.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // ADDED: Access t from useTranslation within render method
      const { t } = useTranslation();

      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-700 mb-4">{t('something_went_wrong')}</h1> {/* MODIFIED */}
            <p className="text-gray-700 mb-4">
              {t('unexpected_error_occurred')} {/* MODIFIED */}
            </p>
            {this.state.error && (
              <details className="text-left text-sm text-gray-600 bg-gray-100 p-3 rounded-md overflow-auto max-h-60">
                <summary className="font-semibold cursor-pointer">{t('error_details')}</summary> {/* MODIFIED */}
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('refresh_page')} {/* MODIFIED */}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;