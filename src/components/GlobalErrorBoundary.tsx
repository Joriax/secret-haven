import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const APP_NAME = 'Phantom Lock';
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Global Error Boundary for the entire application
 * Provides user-friendly error messages and recovery options
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GlobalErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Log to analytics/monitoring service in production
    if (import.meta.env.PROD) {
      // Could integrate with Sentry, LogRocket, etc.
      console.error('Production error:', {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private handleClearDataAndReload = () => {
    // Clear localStorage and sessionStorage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-lg w-full text-center space-y-6">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            
            {/* Title and Description */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-foreground">
                {APP_NAME} hat einen Fehler entdeckt
              </h1>
              <p className="text-muted-foreground">
                Ein unerwarteter Fehler ist aufgetreten. Keine Sorge, deine Daten sind sicher. 
                Du kannst versuchen, die Seite neu zu laden oder zum Dashboard zurückzukehren.
              </p>
            </div>

            {/* Error ID for support */}
            {this.state.errorId && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">
                  Fehler-ID: <code className="font-mono">{this.state.errorId}</code>
                </p>
              </div>
            )}

            {/* Dev mode: Show error details */}
            {isDev && this.state.error && (
              <div className="p-4 rounded-lg bg-muted/50 text-left overflow-auto max-h-48">
                <p className="text-xs font-mono text-destructive break-all mb-2">
                  <strong>Error:</strong> {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="gap-2 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Erneut versuchen
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="gap-2 w-full sm:w-auto"
              >
                <Home className="w-4 h-4" />
                Zum Dashboard
              </Button>
            </div>

            {/* Secondary Actions */}
            <div className="pt-4 border-t border-border">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
                <button
                  onClick={this.handleReload}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Seite neu laden
                </button>
                <span className="hidden sm:inline text-muted-foreground/50">•</span>
                <button
                  onClick={this.handleClearDataAndReload}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cache leeren und neu starten
                </button>
              </div>
            </div>

            {/* Support Contact */}
            <p className="text-xs text-muted-foreground pt-4">
              Wenn das Problem weiterhin besteht, kontaktiere den Support mit der Fehler-ID.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping components with GlobalErrorBoundary
 */
export function withGlobalErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithGlobalErrorBoundary(props: P) {
    return (
      <GlobalErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </GlobalErrorBoundary>
    );
  };
}
