import { Link } from "react-router-dom";
import { Container, Eyebrow } from "../components/ui";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] items-center py-[var(--mkt-section-y)]">
      <Container>
        <div className="max-w-[40rem]">
          <Eyebrow className="mb-5">404</Eyebrow>
          <h1 className="text-balance font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.033em] text-foreground">
            That page isn't on the board.
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-muted-foreground">
            The link may be old, or the page moved. Here's the way back.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="mkt-lift inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Home
            </Link>
            <Link
              to="/product"
              className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 px-6 py-3 text-sm font-medium text-foreground hover:border-foreground/25"
            >
              Product tour
            </Link>
            <Link
              to="/app"
              className="mkt-lift inline-flex items-center rounded-full border border-foreground/12 px-6 py-3 text-sm font-medium text-foreground hover:border-foreground/25"
            >
              Open the app
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
