import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the fallback UI (e.g. "AI Tutor"). */
  label?: string;
  /** Optional custom fallback element. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Route-level error boundary.
 *
 * Catches render-time exceptions thrown by lazy chunks, query-rendered
 * components, etc., and shows a friendly retry UI instead of a blank page.
 * Reports to Sentry when the SDK is initialized at runtime.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Best-effort Sentry report. We avoid a hard import so this file
    // remains usable even when Sentry isn't installed in dev.
    type SentryGlobal = { captureException?: (e: unknown, ctx?: unknown) => void };
    const sentry = (window as unknown as { Sentry?: SentryGlobal }).Sentry;
    if (sentry?.captureException) {
      sentry.captureException(error, { extra: errorInfo });
    } else {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.props.label ? `${this.props.label} failed to load.` : "This page failed to load."}{" "}
            You can retry or refresh the browser.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={this.handleRetry}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm font-medium"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
