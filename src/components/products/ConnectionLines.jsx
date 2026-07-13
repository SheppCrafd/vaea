// Decorative static SVG connections — simulate links between related cards.
export default function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <path d="M 10 20 C 80 10, 150 60, 220 30" stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
      <path d="M 30 80 C 100 100, 160 40, 240 90" stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
    </svg>
  );
}