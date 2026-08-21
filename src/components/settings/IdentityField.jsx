// The real Name/Identity/Soul/About-you field config and its exact
// label+input/textarea markup — split out of AiPreferencesSection.jsx so
// demos.jsx's IdentityFilm can render this exact component (readOnly, no
// save wiring) instead of a hand-built recreation with slightly different
// classes.
export const FIELDS = [
  { key: "name", label: "Name", placeholder: "Vaea Chat (default) — or give it a name of your own", rows: 1 },
  { key: "identity", label: "Identity", placeholder: "Who is it? What's its role here?", rows: 2 },
  { key: "soul", label: "Soul (tone & protocol)", placeholder: "E.g., Direct, no filler. When I mention a bug or ask which approach to take, always give me two alternatives and compare them before answering.", rows: 3 },
  { key: "userProfile", label: "About you", placeholder: "How you work, what you value, how you like to communicate.", rows: 3 },
];

export default function IdentityField({ field, value, onChange, readOnly = false }) {
  const { key, label, placeholder, rows } = field;
  const id = `ai-identity-${key}${readOnly ? "-demo" : ""}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium mb-1.5 block">{label}</label>
      {rows === 1 ? (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          readOnly={readOnly}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
        />
      )}
    </div>
  );
}
