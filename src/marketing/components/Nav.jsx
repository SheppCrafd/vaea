import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/product", label: "Product" },
  { to: "/vaea-chat", label: "Vaea Chat" },
  { to: "/brain", label: "Vaea Brain" },
  { to: "/workplace", label: "Vaea Workplace" },
  { to: "/self-hosting", label: "Self-hosting" },
  { to: "/privacy", label: "Your info" },
];

// Transparent over the hero, gains a hairline + blur once the page scrolls.
// Below lg the whole link set collapses into a full-height sheet (six
// items is too many to sit inline on a tablet). Primary CTA stays visible at
// every width.
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-200",
        scrolled ? "border-b border-foreground/[0.07] bg-background/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1140px] items-center justify-between px-6 sm:px-8">
        <Link to="/" className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground" aria-label="Vaea home">
          Vaea
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "text-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Log in
          </Link>
          <Link
            to="/signup"
            className="mkt-lift inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--signal)/0.6)]"
          >
            Start your board
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-1 px-6 py-6">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base text-foreground hover:bg-muted"
              >
                {l.label}
              </NavLink>
            ))}
            <div className="my-4 h-px bg-foreground/10" />
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-base text-muted-foreground hover:bg-muted"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-base font-medium text-primary-foreground"
            >
              Start your board
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
