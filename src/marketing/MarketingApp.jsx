import { Routes, Route, Navigate } from "react-router-dom";
import MarketingLayout from "./MarketingLayout";
import Home from "./pages/Home";
import VaeaChat from "./pages/VaeaChat";
import Brain from "./pages/Brain";
import Workplace from "./pages/Workplace";
import Privacy from "./pages/Privacy";
import Compare from "./pages/Compare";
import About from "./pages/About";
import LegalPrivacy from "./pages/LegalPrivacy";
import LegalTerms from "./pages/LegalTerms";
import NotFound from "./pages/NotFound";

// The whole public marketing site. Mounted at "/*" by App.jsx (so the
// explicit /login, /signup and /app routes still win by specificity), and
// rendered directly under a StaticRouter by scripts/prerender.mjs at build
// time. Keep the <Route> list in step with ROUTES in seo.js.
export default function MarketingApp() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/vaea-chat" element={<VaeaChat />} />
        <Route path="/brain" element={<Brain />} />
        <Route path="/workplace" element={<Workplace />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<LegalPrivacy />} />
        <Route path="/terms" element={<LegalTerms />} />
        {/* Old URLs — client-side redirects so external links and old
            bookmarks still land right. Vaea Chat used to live at /assistant;
            the standalone /product tour was folded back into the homepage and
            feature pages; /self-hosting is now the "Local Mode" section of
            /privacy. */}
        <Route path="/assistant" element={<Navigate to="/vaea-chat" replace />} />
        <Route path="/product" element={<Navigate to="/" replace />} />
        <Route path="/self-hosting" element={<Navigate to="/privacy" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
