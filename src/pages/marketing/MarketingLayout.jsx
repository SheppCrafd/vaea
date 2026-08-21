import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { Github, Menu, X, Sun, Moon } from "lucide-react";
import { hairlineH, focusRing } from "./theme";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/chat", label: "Vaea Chat" },
  { to: "/calendar", label: "Vaea Calendar" },
  { to: "/vmail", label: "Vmail" },
  { to: "/meetings", label: "Vaea Meetings" },
  { to: "/workflows", label: "Vaea Workflows" },
  { to: "/mindmap", label: "Mind Map" },
  { to: "/vault", label: "Vaea Brain" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/compare", label: "Compare" },
  { to: "/about", label: "About" },
];

const GITHUB_URL = "https://github.com/SheppCrafd/vaea";

// Maintainer contact card, sourced from the Gravatar profile at
// gravatar.com/sheppcrafd — reused as-is on the About page.
export const MAINTAINER = {
  name: "SheppCrafd",
  bio: "Builds mods, builds robots, builds modded robots",
  avatar: "https://0.gravatar.com/avatar/2daa5fe613a74df44eda666f4db3967a88369f873fd614400b4660d986d0d3d6?s=200",
  github: "https://github.com/SheppCrafd",
  email: "mwallis31@outlook.com",
  gravatar: "https://gravatar.com/sheppcrafd",
};

function Logo() {
  return (
    <Link to="/" className={`flex items-center gap-2 shrink-0 rounded-full ${focusRing}`}>
      <div className="w-8 h-8 rounded-full border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.12)] overflow-hidden">
        <img src="/android-chrome-512x512.png" alt="" className="w-full h-full object-cover" />
      </div>
      <span className="font-terminal text-base font-bold tracking-tight">Vaea</span>
    </Link>
  );
}

// A visitor has no Settings page to reach before signing up, and the site's
// own dark bands/light sections both depend on knowing which theme is
// active — so the public site needs its own switch, not just the one
// buried in Settings -> Appearance for signed-in use. resolvedTheme (not
// theme) so a first-time visitor on "system" still sees the icon matching
// what's actually on screen, not a blank/wrong guess.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center justify-center w-9 h-9 rounded-full bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 ${focusRing}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

// The frosted sticky bar, apple.com-style: no border-b line at all — the
// bar's edge is a 1px shadow (an opacity shift over whatever scrolls
// beneath) plus a wide soft falloff, and the glass itself is a heavily
// saturated blur so colors passing under it stay vivid instead of going
// gray. Stays theme-adaptive (bg-background) rather than hardcoded dark, so
// it tracks the user's light/dark preference and reads the same whether a
// dark band or a light section is scrolling underneath.
function NavBar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-background/70 supports-[backdrop-filter]:bg-background/55 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_1px_0_0_hsl(var(--foreground)/0.06),0_16px_32px_-24px_hsl(200_30%_12%/0.3)] dark:shadow-[0_1px_0_0_hsl(var(--foreground)/0.08),0_0_24px_-8px_hsl(var(--foreground)/0.10)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-8 min-w-0">
          <Logo />
          {/* overflow-x-auto, not flex-wrap: 11 links at narrower desktop
              widths scroll horizontally within the bar rather than wrapping
              to a second row, which would break the header's fixed h-16 —
              same reasoning as the in-app Header.jsx tab bar. */}
          <nav className="hidden sm:flex items-center gap-6 overflow-x-auto min-w-0">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm shrink-0 whitespace-nowrap transition-colors rounded-sm ${focusRing} ${
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
              aria-label="GitHub repository"
              className={`flex items-center gap-1.5 text-sm shrink-0 whitespace-nowrap text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">GitHub</span>
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />
          <Link
            to="/login"
            className={`hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors px-2 rounded-sm ${focusRing}`}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className={`text-sm px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full transition-all hover:shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.5)] ${focusRing}`}
          >
            Sign up
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className={`sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors -mr-1 ${focusRing}`}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="sm:hidden bg-background/85 backdrop-blur-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`text-sm py-2.5 transition-colors rounded-sm ${focusRing} ${
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
            className={`flex items-center gap-1.5 text-sm py-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className={`text-sm py-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            onClick={() => setMobileOpen(false)}
            className={`text-sm py-2.5 font-medium text-foreground transition-colors rounded-sm ${focusRing}`}
          >
            Sign up
          </Link>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gradient-to-b from-transparent to-muted/50">
      <div aria-hidden="true" className={hairlineH} />
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid sm:grid-cols-[1.3fr_0.8fr_0.8fr_1.1fr] gap-10">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              For when there's too much going on: a personal workspace with Vaea Chat, an AI that actually handles it instead of just talking about it. Everything stays on your own device.
            </p>
          </div>

          <div>
            <p className="font-terminal text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3.5">Product</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Home</Link></li>
              <li><Link to="/features" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Features</Link></li>
              <li><Link to="/how-it-works" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>How it works</Link></li>
              <li><Link to="/chat" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vaea Chat</Link></li>
              <li><Link to="/calendar" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vaea Calendar</Link></li>
              <li><Link to="/vmail" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vmail</Link></li>
              <li><Link to="/meetings" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vaea Meetings</Link></li>
              <li><Link to="/workflows" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vaea Workflows</Link></li>
              <li><Link to="/mindmap" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Mind Map</Link></li>
              <li><Link to="/vault" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Vaea Brain</Link></li>
              <li><Link to="/compare" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Compare</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-terminal text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3.5">Resources</p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>
                  <Github className="w-3.5 h-3.5" />
                  Source on GitHub
                </a>
              </li>
              <li><Link to="/login" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Sign in</Link></li>
              <li><Link to="/privacy" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-terminal text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3.5">Contact</p>
            <Link to="/about" className={`flex items-center gap-2.5 group rounded-sm ${focusRing}`}>
              <img src={MAINTAINER.avatar} alt="" className="w-9 h-9 rounded-full border border-border shrink-0" />
              <span className="text-sm">
                <span className="block text-foreground font-medium group-hover:underline">{MAINTAINER.name}</span>
                <span className="block text-xs text-muted-foreground">Built & maintained solo</span>
              </span>
            </Link>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <a href={`mailto:${MAINTAINER.email}`} className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>
                  {MAINTAINER.email}
                </a>
              </li>
              <li>
                <a href={MAINTAINER.gravatar} target="_blank" rel="noopener noreferrer" className={`text-muted-foreground hover:text-foreground transition-colors rounded-sm ${focusRing}`}>
                  Gravatar profile
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <div aria-hidden="true" className={hairlineH} />
          <p className="pt-6 text-xs text-muted-foreground">Vaea. Your stuff stays on your device by default, always your choice.</p>
          <p className="mt-1.5 text-xs text-muted-foreground/70">&copy; {new Date().getFullYear()} Vaea. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children }) {
  return (
    // overflow-x-hidden lives on <main>, not this wrapper — an ancestor with
    // overflow-x set (even just on one axis) becomes position:sticky's
    // containing block for everything inside it, which silently breaks
    // NavBar's sticky header the moment it's not the real viewport anymore.
    // main is where the full-bleed decorative stuff (StageLight, DarkBand
    // glows) that this was clipping for actually lives, so it still does its
    // job — just without being NavBar's ancestor too.
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <Footer />
    </div>
  );
}
