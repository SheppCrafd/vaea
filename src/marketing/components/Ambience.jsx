// Page backdrop for the marketing site — the same language as the app's
// AuthAmbience (a vertical wash + primary-tinted radial blooms reading the
// app's own --primary token), extended to sit fixed behind a long
// scrolling document. Pure decoration: aria-hidden, pointer-events-none,
// zero layout, no motion (so it costs nothing and never distracts from the
// one moving thing on the page, the hero board).
export default function Ambience() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--muted)/0.6)_0%,hsl(var(--background))_30%,hsl(var(--background))_72%,hsl(var(--muted)/0.5)_100%)]" />
      <div className="absolute -top-[28%] inset-x-0 h-[70%] bg-[radial-gradient(52%_58%_at_50%_32%,hsl(var(--primary)/0.09),hsl(var(--primary)/0.03)_46%,transparent_74%)]" />
      <div className="absolute top-[40%] -right-[18%] h-[46%] w-[52%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.05),transparent)]" />
      <div className="absolute -bottom-[16%] -left-[14%] h-[46%] w-[46%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.05),transparent)]" />
    </div>
  );
}
