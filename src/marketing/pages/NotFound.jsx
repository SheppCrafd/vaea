import { Link } from "react-router";
import { Container, Eyebrow } from "../components/ui";
import ParallaxBackdrop from "../components/ParallaxBackdrop";

// One plain message, the same every time: a random pick changed the text
// after the page loaded (the prerendered copy and the browser chose
// differently), and the jokes read as filler on an error page.
const TITLE = "Page not found";
const BODY = "This link doesn't lead to a page on Vaea. It may be old, or the page may have moved.";

export default function NotFound() {
  const title = TITLE;
  const body = BODY;

  return (
    <ParallaxBackdrop
      as="section"
      src="/img/marketing/notfound-beach.jpg"
      eager
      strength={120}
      scrim={0.72}
      position="50% 46%"
      className="flex min-h-[78vh] items-center py-[var(--mkt-section-y)]"
    >
      <Container>
        <div className="max-w-[40rem]">
          <Eyebrow className="mb-5">404</Eyebrow>
          <h1 className="text-balance font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.033em] text-foreground">
            {title}
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="mkt-lift inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Home
            </Link>
            <Link
              to="/vaea-chat"
              className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:border-foreground/25"
            >
              Vaea Chat
            </Link>
            <Link
              to="/app"
              className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:border-foreground/25"
            >
              Open the app
            </Link>
          </div>
        </div>
      </Container>
    </ParallaxBackdrop>
  );
}
