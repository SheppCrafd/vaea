import { Routes, Route, Navigate } from "react-router-dom";
import MarketingLayout from "./MarketingLayout";
import Home from "./pages/Home";
import Product from "./pages/Product";
import VaeaChat from "./pages/VaeaChat";
import Brain from "./pages/Brain";
import Workplace from "./pages/Workplace";
import SelfHosting from "./pages/SelfHosting";
import Privacy from "./pages/Privacy";
import Pricing from "./pages/Pricing";
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
        <Route path="/product" element={<Product />} />
        <Route path="/vaea-chat" element={<VaeaChat />} />
        <Route path="/brain" element={<Brain />} />
        <Route path="/workplace" element={<Workplace />} />
        <Route path="/self-hosting" element={<SelfHosting />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<LegalPrivacy />} />
        <Route path="/terms" element={<LegalTerms />} />
        {/* Old URL — Vaea Chat used to live at /assistant. Client-side
            redirect so external links and old bookmarks still land right. */}
        <Route path="/assistant" element={<Navigate to="/vaea-chat" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
