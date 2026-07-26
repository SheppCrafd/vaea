// Shared visual vocabulary for the public marketing site's "luxury" pass —
// deliberately scoped to src/pages/marketing/, not the app's own design
// tokens in index.css/tailwind.config.js. The app's palette (see
// Vaea - Visual Design Refresh) is theme-adaptive and stays untouched; these
// dark sections are fixed hex values on purpose, carrying the app's own 200°
// graphite-teal hue into a near-black gradient so the marketing site still
// reads as the same brand, not a different product.

// Full-bleed dark section background — the "product screen" treatment
// alternated with theme-adaptive light sections down the page.
export const darkSectionBg = "bg-gradient-to-b from-[#0D1316] via-[#0A1013] to-[#080B0C]";
export const darkText = "text-[#F5F7F7]";
export const darkSubtext = "text-white/60";
export const darkHairline = "border-white/10";

// Glass panel — the one signature surface treatment reused for every product
// mockup (the chat transcript, the vault note) and the FAQ shell. An inset
// top highlight simulates a glossy reflection; the outer shadow keeps it
// feeling lifted off the dark gradient rather than flat.
export const glassPanel =
  "bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_70px_-20px_rgba(0,0,0,0.75)]";

// A lighter glass treatment for tiles sitting on theme-adaptive light
// sections (feature/highlight grids) — reads as "premium" without fighting
// the light background the way a dark glass panel would.
export const glassTileLight =
  "bg-gradient-to-b from-card to-muted/50 border border-border/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300";

// High-contrast pill CTAs — always the opposite tone of whatever section
// they sit on, matching the "Buy"-pill contrast Apple uses regardless of
// the imagery behind it.
export const pillOnDark =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-white hover:bg-white/90 text-[#0D1316] font-medium rounded-full transition-colors";
export const pillOnLight =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-[#0D1316] hover:bg-[#182125] text-white font-medium rounded-full transition-colors";

export const linkOnDark = "text-sm text-white/60 hover:text-white transition-colors";
export const linkOnLight = "text-sm text-muted-foreground hover:text-foreground transition-colors";

export const eyebrowOnDark = "font-terminal text-xs uppercase tracking-[0.2em] text-white/50";
export const eyebrowOnLight = "font-terminal text-xs uppercase tracking-[0.2em] text-primary";

// The signature glow color — a brighter, more saturated cyan-teal than the
// app's own muted primary, reserved for glow halos and small accent details
// only. Never used as a fill or body-text color; the restraint is the point.
export const GLOW = "#46BAD1";
