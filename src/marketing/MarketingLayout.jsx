import { useLocation, Outlet, Link } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Ambience from "./components/Ambience";
import SeoHead from "./SeoHead";
import "./marketing.css";

// Shell for every marketing route: a normal scrollable document (the
// app-shell scroll lock lives only under /app). Nav is sticky; a mobile
// sticky-CTA sits in the thumb zone; the ambient backdrop is fixed behind
// everything.
export default function MarketingLayout() {
  const { pathname } = useLocation();
  return (
    <div className="mkt relative min-h-screen overflow-x-clip bg-background font-body text-foreground antialiased">
      <SeoHead pathname={pathname} />
      <Ambience />
      <Nav />
      <main id="main">
        <Outlet />
      </main>
      <Footer />

      {/* mobile sticky CTA — one action, thumb zone, clears the OS home bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/[0.08] bg-background/90 px-4 pt-2.5 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <Link
          to="/signup"
          className="flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_-12px_rgb(var(--signal-rgb)/0.6)]"
        >
          Start your board
        </Link>
        <p className="mt-1.5 text-center font-mono text-[0.66rem] tracking-tight text-muted-foreground">
          Free · no card · your info stays on your computer
        </p>
      </div>
      <div className="h-24 md:hidden" aria-hidden="true" />
    </div>
  );
}
