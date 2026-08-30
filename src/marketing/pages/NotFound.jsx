import { useState } from "react";
import { Link } from "react-router-dom";
import { Container, Eyebrow } from "../components/ui";
import ParallaxBackdrop from "../components/ParallaxBackdrop";

// One of these is picked at random each time the page loads. Kept light —
// a 404 is the one surface where a little personality reads as care rather
// than sloppiness — but on-theme and free of inside jokes.
const MESSAGES = [
  ["That page isn't on the board.", "The link may be old, or the page moved. Here's the way back."],
  ["This one drifted out with the tide.", "Whatever you were after has moved. Try one of these."],
  ["Nothing at this coordinate.", "The page you asked for isn't here. The board still is."],
  ["You've wandered past the last marker.", "There's no page at this link — but there is a way back."],
  ["404 — below sea level.", "This address doesn't lead anywhere. These do."],
  ["Just sand and horizon here.", "The page moved or never existed. Pick a direction."],
  ["The map ends at this point.", "No page at this address. Head back to solid ground."],
  ["This page is off exploring somewhere.", "It isn't at this link. Start again from home."],
];

export default function NotFound() {
  const [[title, body]] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  return (
    <ParallaxBackdrop
      as="section"
      src="/img/marketing/notfound-beach.jpg"
      eager
      strength={40}
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
              to="/product"
              className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:border-foreground/25"
            >
              Product tour
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
