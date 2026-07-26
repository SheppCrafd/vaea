import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Github, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
];

const GITHUB_URL = "https://github.com/SheppCrafd/vaea";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0">
      <div className="w-7 h-7 rounded-full ring-1 ring-border shadow-sm overflow-hidden">
        <img src="/android-chrome-512x512.png" alt="" className="w-full h-full object-cover" />
      </div>
      <span className="font-terminal text-[15px] font-bold tracking-tight">Vaea</span>
    </Link>
  );
}

// A minimal, always-light glass strip — Apple's own global nav stays a thin
// translucent bar regardless of what's scrolling underneath it (dark hero,
// light section, product photo); it doesn't invert to match. Kept
// theme-adaptive (bg-background) rather than hardcoded, so it still tracks
// the user's light/dark preference the way the rest of the app does.
function NavBar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-9">
          <Logo />
          <nav className="hidden sm:flex items-center gap-7">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-[13px] tracking-wide transition-colors ${
                  location.pathname === to
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="hidden sm:inline text-[13px] text-muted-foreground hover:text-foreground transition-colors px-2"
          >
            Log in
          </Link>
          <Link
            to="/login"
            className="text-[13px] px-4 py-[7px] bg-foreground hover:bg-foreground/85 text-background font-medium rounded-full transition-colors"
          >
            Sign up
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors -mr-1"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="sm:hidden border-t border-border bg-background px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`text-sm py-2.5 transition-colors ${
                location.pathname === to
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm py-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="text-sm py-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-[1.5fr_1fr_1fr] gap-10">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              For when there's too much going on: a personal workspace with Vaea Chat, an AI that actually handles it instead of just talking about it. Everything stays on your own device.
            </p>
          </div>

          <div>
            <p className="font-terminal text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3.5">Product</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link></li>
              <li><Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
              <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it works</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-terminal text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3.5">Resources</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="w-3.5 h-3.5" />
                  Source on GitHub
                </a>
              </li>
              <li><Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
          Vaea. Your stuff stays on your device, always.
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
