// Page backdrop for the marketing site — the same token language as the
// app's AuthAmbience (a vertical wash + primary-tinted blooms reading the
// app's own --primary token), extended to sit fixed behind a long scrolling
// document. The one deliberate addition for the marketing context: a still
// horizon — a hairline and a soft band of haze sitting a little below
// centre, fixed to the viewport so every section scrolls past it. It reads
// as "sea level" without a single photograph, and stays motionless (so it
// costs nothing and never competes with the one moving thing on the page,
// the hero board). Pure decoration: aria-hidden, pointer-events-none, zero
// layout.
export default function Ambience() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* vertical wash — sky above, a touch brighter through the middle */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--muted)/0.6)_0%,hsl(var(--background))_26%,hsl(var(--background))_52%,hsl(var(--muted)/0.42)_60%,hsl(var(--background))_82%,hsl(var(--muted)/0.5)_100%)]" />
      {/* upper bloom */}
      <div className="absolute -top-[28%] inset-x-0 h-[62%] bg-[radial-gradient(52%_58%_at_50%_30%,hsl(var(--primary)/0.08),hsl(var(--primary)/0.03)_46%,transparent_74%)]" />
      {/* the horizon: a wide, very soft band of haze, then a hairline on it */}
      <div className="absolute inset-x-0 top-[52%] h-[16%] bg-[radial-gradient(60%_100%_at_50%_50%,hsl(var(--primary)/0.07),transparent_72%)]" />
      <div className="absolute inset-x-0 top-[58%] h-px bg-[linear-gradient(90deg,transparent,hsl(var(--primary)/0.16)_22%,hsl(var(--primary)/0.16)_78%,transparent)]" />
      {/* pools settling into the lower corners */}
      <div className="absolute top-[46%] -right-[18%] h-[46%] w-[52%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.045),transparent)]" />
      <div className="absolute -bottom-[16%] -left-[14%] h-[46%] w-[46%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.045),transparent)]" />
    </div>
  );
}
