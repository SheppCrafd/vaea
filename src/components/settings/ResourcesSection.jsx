import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";

// A place for links that aren't a Vaea setting to toggle — currently just
// the Vaea Brain (Obsidian+git notes vault) setup guide, which is
// deliberately NOT built into the app itself (see VaultSetupGuidePage.jsx's
// own framing).
export default function ResourcesSection() {
  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Resources</p>
      <Link
        to="/app/settings/vault-setup"
        className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Vaea Brain setup guide</p>
            <p className="text-xs text-muted-foreground">Obsidian + GitHub, for notes that live outside Vaea</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
