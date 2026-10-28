import { Component } from "react";

// Without this, any uncaught error during render or a layout effect
// (anywhere in the tree below) unmounts the whole app with no fallback —
// React's default behavior — which looks exactly like a blank white page
// with no clue why. This turns that into a visible error + a reload button.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-3">
            <p className="font-heading text-lg font-semibold">This screen stopped working</p>
            <p className="text-sm text-muted-foreground">
              Your saved work isn't affected. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium"
            >
              Reload
            </button>
            {/* The technical message, for a bug report — kept out of the main line. */}
            <details className="pt-2 text-left text-xs text-muted-foreground">
              <summary className="cursor-pointer text-center">Error details</summary>
              <p className="mt-2 break-words font-mono">{this.state.error.message}</p>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
