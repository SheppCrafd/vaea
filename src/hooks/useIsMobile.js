import { useState, useEffect } from "react";

const QUERY = "(max-width: 767px)";

// 767px, not 768px — flips exactly at Tailwind's default `md` breakpoint
// (which applies at min-width: 768px), so this JS check and the app's
// existing `md:` classes (Header.jsx's hamburger, this same threshold
// everywhere else responsive is handled) never disagree about where
// "mobile" ends.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
