import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

// The app's own 404 (anything under /app that isn't a route). Rendered on
// its own, not inside AppShell: the dashboard toolbar, Notepad and Archive
// buttons around a missing page read as if the dashboard itself were broken.
export default function PageNotFound() {
  const { pathname } = useLocation();

  return (
    <div className="h-full min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="font-heading text-6xl font-light text-muted-foreground/50" aria-hidden="true">404</p>
        <h1 className="font-heading text-2xl font-medium text-foreground">This page doesn't exist</h1>
        <p className="text-muted-foreground leading-relaxed">
          There's nothing at <code className="font-mono text-sm text-foreground break-all">{pathname}</code>. The link
          may be out of date, or the address may have a typo.
        </p>
        <div className="pt-2">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md border border-border bg-card hover:bg-accent transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to the dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
