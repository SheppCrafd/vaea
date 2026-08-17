// Standard shadcn Skeleton primitive — didn't exist in this repo yet
// (src/components/ui only had accordion/button/input/toast). Uses the same
// --motion-slow token as the rest of the new motion system (index.css) via
// the .skeleton-pulse class, instead of Tailwind's default animate-pulse
// timing, so it stays visually consistent with card-enter/row-enter.
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`skeleton-pulse rounded-md bg-muted ${className}`}
      {...props}
    />
  );
}
