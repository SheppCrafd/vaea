import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

// Wraps anything that's a real "where's ___" destination (a Header tab, a
// Settings sidebar section) so the OPEN_APP_SECTION chat tool can scroll to
// it and pulse a highlight around it, the same way a person would point at
// something on screen. Purely additive — renders its child exactly as-is
// plus this behavior, no layout changes when nothing's pending.
export default function SectionAnchor({ id, className = "", children, as: Tag = "div" }) {
  const pendingHighlightId = useAppStore((s) => s.pendingHighlightId);
  const clearHighlight = useAppStore((s) => s.clearHighlight);
  const ref = useRef(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (pendingHighlightId !== id || !ref.current) return;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulsing(true);
    const stopPulse = setTimeout(() => setPulsing(false), 2200);
    const clear = setTimeout(() => clearHighlight(), 2300);
    return () => {
      clearTimeout(stopPulse);
      clearTimeout(clear);
    };
  }, [pendingHighlightId, id, clearHighlight]);

  return (
    <Tag
      ref={ref}
      className={`${className} ${pulsing ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse rounded-lg" : ""}`}
    >
      {children}
    </Tag>
  );
}
