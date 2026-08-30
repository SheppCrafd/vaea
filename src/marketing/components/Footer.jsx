import { Link } from "react-router-dom";
import { SITE_MODIFIED } from "../seo";

const COLS = [
  {
    heading: "Product",
    links: [
      { to: "/product", label: "Product tour" },
      { to: "/vaea-chat", label: "Vaea Chat" },
      { to: "/brain", label: "Vaea Brain" },
      { to: "/workplace", label: "Vaea Workplace" },
      { to: "/self-hosting", label: "Self-hosting" },
      { to: "/compare", label: "Vaea vs. the usual setup" },
      { to: "/privacy", label: "Where your info lives" },
    ],
  },
  {
    heading: "Company",
    links: [{ to: "/about", label: "Who makes Vaea" }],
    external: [{ href: "https://github.com/SheppCrafd/vaea", label: "Source on GitHub" }],
  },
  {
    heading: "Get started",
    links: [
      { to: "/signup", label: "Create an account" },
      { to: "/login", label: "Log in" },
      { to: "/app", label: "Continue without an account" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { to: "/privacy-policy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms of Use" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-foreground/[0.07] py-16">
      <div className="mx-auto grid w-full max-w-[1140px] gap-x-8 gap-y-12 px-6 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="lg:pr-6">
          <Link to="/" className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Vaea
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            All your work on one board, with Vaea Chat to help run it. Every feature included.
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
              {col.external?.map((l) => (
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
          {new Date(`${SITE_MODIFIED}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} ·
          your information stays on your computer by default.
        </p>
      </div>
    </footer>
  );
}
