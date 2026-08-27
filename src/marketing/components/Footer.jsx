import { Link } from "react-router-dom";
import { SITE_MODIFIED } from "../seo";

const COLS = [
  {
    heading: "Product",
    links: [
      { to: "/product", label: "Product tour" },
      { to: "/assistant", label: "The assistant" },
      { to: "/privacy", label: "Where your info lives" },
      { to: "/app", label: "Open the app" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { to: "/signup", label: "Create an account" },
      { to: "/login", label: "Log in" },
      { to: "/app", label: "Continue without an account" },
    ],
  },
];

const EXTERNAL = [
  { href: "https://github.com/SheppCrafd/vaea", label: "Source on GitHub" },
];

export default function Footer() {
  return (
    <footer className="border-t border-foreground/[0.07] py-16">
      <div className="mx-auto grid w-full max-w-[1140px] gap-12 px-6 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link to="/" className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Vaea
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            All your work on one board, plus an assistant that helps run it. Made and looked after by
            one person. Free, with nothing held back.
          </p>
        </div>

        {COLS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <p className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {col.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
              {col.heading === "Product" &&
                EXTERNAL.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      rel="noreferrer"
                      target="_blank"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-14 flex w-full max-w-[1140px] flex-col gap-2 px-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} Vaea. All rights reserved.</p>
        <p className="font-mono tracking-tight">
          Updated{" "}
          {new Date(SITE_MODIFIED).toLocaleDateString("en-US", { month: "long", year: "numeric" })} ·
          your information stays on your computer by default.
        </p>
      </div>
    </footer>
  );
}
