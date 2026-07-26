// Shared visual vocabulary for the public marketing site's "luxury" pass —
// deliberately scoped to src/pages/marketing/, not the app's own design
// tokens in index.css/tailwind.config.js. The app's palette (see
// Vaea - Visual Design Refresh) is theme-adaptive and stays untouched; these
// dark sections are fixed hex values on purpose, carrying the app's own 200°
// graphite-teal hue into a near-black so the marketing site still reads as
// the same brand, not a different product.

// Full-bleed dark section base. Deliberately NOT a straight top-to-bottom
// fade: the stops cluster near the top so the surface reads as darkest at
// the edges and lifts slightly where StageLight's pool lands, the way a lit
// backdrop actually falls off. StageLight + Grain layer on top of this.
export const darkSectionBg =
  "bg-[linear-gradient(180deg,#080C0E_0%,#0C1418_38%,#090E11_72%,#06090A_100%)]";
export const darkText = "text-[#F4F7F8]";
export const darkSubtext = "text-white/60";
export const darkHairline = "border-white/10";

// The seam between a dark section and whatever sits above it — a single
// bright hairline, the way light catches the top edge of a glass panel.
export const darkTopEdge =
  "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:content-['']";

// Glass panel — the one signature surface treatment, reused for every
// product mockup on a dark section. The inset top highlight is the "gloss";
// the wide, soft drop shadow is what lifts it off the stage.
export const glassPanel =
  "bg-white/[0.045] backdrop-blur-2xl border border-white/[0.09] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_2px_8px_-2px_rgba(0,0,0,0.5),0_40px_90px_-24px_rgba(0,0,0,0.85)]";

// The sheen strip laid over a glass panel's top edge — a real specular
// highlight rather than a flat border, which is most of what separates
// "glassy" from "translucent box".
export const glassSheen =
  "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.07] to-transparent";

// A lighter glass treatment for tiles sitting on theme-adaptive light
// sections — reads as premium without fighting the light background the way
// a dark glass panel would.
export const glassTileLight =
  "bg-gradient-to-b from-card to-muted/50 border border-border/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300";

// The recessed "stage" a light-section demo sits in, so a realistically
// small piece of UI (a command palette, a card stack) can hold a wide
// section without being stretched to a size it never has in the real app.
export const lightStage =
  "rounded-[2rem] bg-[radial-gradient(80%_60%_at_50%_0%,hsl(var(--card)),hsl(var(--muted)/0.5))] border border-border/60 shadow-[inset_0_1px_0_0_hsl(var(--card)),0_1px_2px_0_hsl(200_30%_12%/0.05)]";

// High-contrast pill CTAs — always the opposite tone of whatever section
// they sit on, matching the contrast a "Buy" pill keeps regardless of the
// imagery behind it.
export const pillOnDark =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-white hover:bg-white/90 text-[#0A1013] font-medium rounded-full transition-all hover:-translate-y-0.5 shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)]";
export const pillOnLight =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-all hover:-translate-y-0.5";

export const linkOnDark = "text-sm text-white/60 hover:text-white transition-colors";
export const linkOnLight = "text-sm text-muted-foreground hover:text-foreground transition-colors";

export const eyebrowOnDark = "font-terminal text-xs uppercase tracking-[0.22em] text-white/45";
export const eyebrowOnLight = "font-terminal text-xs uppercase tracking-[0.22em] text-primary";

// Display type: the marketing site keeps the app's own Space Grotesk rather
// than introducing a fourth family for one surface — brand coherence with
// the product is worth more here than novelty. The investment goes into
// scale and tracking instead: big sizes get noticeably tighter tracking,
// which is what makes a large heading look set rather than just enlarged.
export const displayXL =
  "font-heading font-semibold tracking-[-0.035em] leading-[1.02] text-[clamp(2.75rem,7vw,4.75rem)]";
export const displayL =
  "font-heading font-semibold tracking-[-0.03em] leading-[1.06] text-[clamp(2rem,4.5vw,3.25rem)]";
export const displayM = "font-heading text-2xl sm:text-3xl font-semibold tracking-[-0.02em] leading-tight";

// The signature glow color — a brighter, more saturated cyan-teal than the
// app's own muted primary, reserved for glow halos, the caret, and small
// accent details. Never a fill or a body-text color; the restraint is the
// point.
export const GLOW = "#46BAD1";
