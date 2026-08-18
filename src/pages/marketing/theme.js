// Shared visual vocabulary for the public marketing site's "luxury" pass —
// deliberately scoped to src/pages/marketing/, not the app's own design
// tokens in index.css/tailwind.config.js. "Band" sections (hero, CTA, the
// vault demo) are the site's dramatic, full-bleed moments — but as of the
// light/dark toggle in MarketingLayout, they're driven by the --band-*
// tokens in index.css, not fixed hex: near-black in dark theme (unchanged
// from before), a pale luminous cyan-white in light theme (not plain page
// white — see index.css's comment on --band-1..4 for why). Every color
// below reads a CSS variable for exactly this reason: toggling the site's
// theme has to genuinely repaint these sections, not just the sections
// around them.

// Full-bleed band base. Deliberately NOT a straight top-to-bottom fade: the
// stops cluster near the top so the surface reads as darkest/richest at the
// edges and lifts slightly where StageLight's pool lands, the way a lit
// backdrop actually falls off. StageLight + Grain layer on top of this.
export const darkSectionBg =
  "bg-[linear-gradient(180deg,hsl(var(--band-1))_0%,hsl(var(--band-2))_38%,hsl(var(--band-3))_72%,hsl(var(--band-4))_100%)]";
export const darkText = "text-foreground";
export const darkSubtext = "text-muted-foreground";
export const darkHairline = "border-foreground/10";

// The seam between a band and whatever sits above it — a single bright
// hairline, the way light catches the top edge of a glass panel.
export const darkTopEdge =
  "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-foreground/20 before:to-transparent before:content-['']";

// Glass panel — the one signature surface treatment, reused for every
// product mockup on a band. The tint and border read --foreground (near-
// white on a dark band, near-black on a light one) so the panel keeps
// definition against whichever band color is active — without that, a
// barely-there white tint on an already-light band would just vanish. The
// gloss highlight stays literal white — a specular highlight is a physical
// effect, not a page color, and looks right regardless of theme. The
// ambient DROP shadow doesn't: a black shadow cast onto an already near-
// black dark-theme band is close to invisible, so dark mode swaps it for a
// soft --foreground-tinted glow instead (the same panel "lifting" off the
// surface, just via light instead of cast shadow — the way an object would
// actually read as elevated against a dark backdrop).
export const glassPanel =
  "bg-foreground/[0.045] backdrop-blur-2xl border border-foreground/[0.09] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_2px_8px_-2px_rgba(0,0,0,0.5),0_40px_90px_-24px_rgba(0,0,0,0.85)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_0_1px_0_hsl(var(--foreground)/0.14),0_8px_40px_-4px_hsl(var(--foreground)/0.12)]";

// The sheen strip laid over a glass panel's top edge — a real specular
// highlight rather than a flat border, which is most of what separates
// "glassy" from "translucent box". Stays literal white for the same reason
// glassPanel's inset highlight does.
export const glassSheen =
  "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.07] to-transparent";

// A lighter glass treatment for tiles sitting on theme-adaptive light
// sections — reads as premium without fighting the light background the way
// a dark glass panel would. The 1px edge is a shadow ring (an opacity shift
// over whatever's behind it), not a solid border — no hard lines anywhere
// on the marketing surface. The ambient shadow layer uses a hardcoded near-
// black hue (200 30% 12%) rather than a theme token, so — same problem as
// glassPanel above — it needs its own dark: glow swap rather than just
// getting darker.
export const glassTileLight =
  "bg-gradient-to-b from-card to-muted/50 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_1px_2px_0_hsl(200_30%_12%/0.06)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.08),0_0_10px_-2px_hsl(var(--foreground)/0.14)] hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_4px_10px_-2px_hsl(200_30%_12%/0.12)] dark:hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.12),0_0_16px_-2px_hsl(var(--foreground)/0.20)] hover:-translate-y-0.5 transition-all duration-300";

// The recessed "stage" a light-section demo sits in, so a realistically
// small piece of UI (a command palette, a card stack) can hold a wide
// section without being stretched to a size it never has in the real app.
// "Light-section" means light in LIGHT theme — in dark theme this same
// section's background (--background/--muted) is dark too, so the ambient
// shadow layer gets the same dark:-glow treatment as everything else here.
export const lightStage =
  "rounded-[2rem] bg-[radial-gradient(80%_60%_at_50%_0%,hsl(var(--card)),hsl(var(--muted)/0.5))] shadow-[inset_0_1px_0_0_hsl(var(--card)),0_0_0_1px_hsl(var(--foreground)/0.045),0_1px_2px_0_hsl(200_30%_12%/0.05)] dark:shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06),0_0_0_1px_hsl(var(--foreground)/0.08),0_0_24px_-4px_hsl(var(--foreground)/0.10)]";

// A light section whose edges dissolve into a muted wash instead of meeting
// the neighbouring section at a border-t line — two of these stacked read as
// one continuous surface with a soft valley where they touch.
export const lightWash =
  "bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.55)_28%,hsl(var(--muted)/0.55)_72%,hsl(var(--background))_100%)]";

// Gradient hairline — the replacement for every border-t/border-b rule line
// on light surfaces: brightest in the middle, dissolving to nothing at the
// ends, so it reads as a fold in the surface rather than a drawn line.
export const hairlineH =
  "h-px w-full bg-gradient-to-r from-transparent via-foreground/[0.09] to-transparent";

// Faint cyan bloom pinned to a light section's top edge — the light-mode
// sibling of StageLight, at a fraction of the intensity.
export const glowTop =
  "pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(55%_70%_at_50%_0%,rgba(70,186,209,0.07),transparent_70%)]";

// High-contrast pill CTAs — always the opposite tone of whatever section
// they sit on, matching the contrast a "Buy" pill keeps regardless of the
// imagery behind it. Now that a band's own tone flips with theme, "opposite
// of the band" and "opposite of a light section" resolve to the exact same
// foreground/background swap — pillOnDark and pillOnLight are kept as
// separate exports for call-site clarity (which surface a button sits on),
// not because they still differ.
export const pillOnDark =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-all hover:-translate-y-0.5 shadow-[0_8px_24px_-8px_hsl(var(--foreground)/0.4)] outline-none focus-visible:ring-2 focus-visible:ring-[#46BAD1] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const pillOnLight =
  "inline-flex items-center gap-1.5 text-sm px-6 py-3 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-all hover:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[#46BAD1] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const linkOnDark =
  "text-sm text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#46BAD1] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";
export const linkOnLight =
  "text-sm text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#46BAD1] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

// Keyboard focus ring, shared by every interactive element on the marketing
// site (pills, nav links, footer links, the theme toggle). Uses the same
// signature glow color as an accent detail (see GLOW's own comment below),
// with ring-offset-background so the offset always matches whatever surface
// the control sits on — a dark band or a light section — without a
// per-surface variant. box-shadow (which ring-* compiles to) inherits the
// element's own border-radius, so this reads correctly on rounded-full pills
// and plain text links alike with no extra radius utility needed.
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#46BAD1] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const eyebrowOnDark = "font-terminal text-xs uppercase tracking-[0.22em] text-foreground/45";
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
