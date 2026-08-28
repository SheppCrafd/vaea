import { Routes, Route } from "react-router-dom";
import MarketingLayout from "./MarketingLayout";
import Home from "./pages/Home";
import Product from "./pages/Product";
import Assistant from "./pages/Assistant";
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
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<LegalPrivacy />} />
        <Route path="/terms" element={<LegalTerms />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
