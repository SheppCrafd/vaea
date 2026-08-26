// The shared ambient backdrop behind LoginScreen/SignUpScreen — a
// theme-adaptive light-or-dark surface: one ultra-smooth vertical wash so
// the page never reads as a flat fill, a soft primary-tinted bloom from
// above, and a fainter primary pool in the lower corner so the falloff has
// a direction. All tints read the app's own --primary token (no bespoke
// accent), matching the product's surface language. Pure decoration —
// pointer-events-none, aria-hidden, zero layout.
export default function AuthAmbience() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--muted)/0.7)_0%,hsl(var(--background))_38%,hsl(var(--background))_68%,hsl(var(--muted)/0.55)_100%)]" />
      <div className="absolute -top-1/3 inset-x-0 h-[75%] bg-[radial-gradient(50%_60%_at_50%_35%,hsl(var(--primary)/0.08),hsl(var(--primary)/0.03)_45%,transparent_75%)]" />
      <div className="absolute -bottom-1/4 -left-1/4 w-[65%] h-[65%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.06),transparent)]" />
    </div>
  );
}
