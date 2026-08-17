import { useEffect, useRef, useState } from "react";

// gravatar.com/{username}.card renders its content vertically centered in
// whatever height the embedding page gives it — the 415x228 Gravatar's own
// docs suggest is only right for a minimal profile; this one has a header
// banner, GitHub badge, and a two-line bio, which need ~400px at 415px
// wide before content stops clipping (measured directly against the live
// card). Shrinking the iframe element itself (via CSS width) wouldn't
// reflow that layout anyway, only clip it — scaling the iframe's own
// content via a CSS transform (while keeping its native width/height
// attributes) is the only way to resize it without breaking anything
// inside. This measures the container with a ResizeObserver and
// recomputes the scale on any layout change, not just once on mount.
const NATIVE_WIDTH = 415;
const NATIVE_HEIGHT = 400;

export default function GravatarCard({ username, name, dark, className = "" }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / NATIVE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-2xl ${className}`}
      style={{ height: NATIVE_HEIGHT * scale }}
    >
      <iframe
        src={`https://gravatar.com/${username}.card`}
        title={`${name}'s Gravatar profile card`}
        width={NATIVE_WIDTH}
        height={NATIVE_HEIGHT}
        style={{
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          // Gravatar has no light/dark toggle of its own (?theme=dark is a
          // no-op) — inverting is the standard trick for a fixed-white
          // iframe on a dark page. The avatar's own colors invert along
          // with it; a known tradeoff of the technique, not a bug.
          filter: dark ? "invert(0.93) hue-rotate(180deg)" : "none",
        }}
      />
    </div>
  );
}
