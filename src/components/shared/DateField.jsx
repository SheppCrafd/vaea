import { useDateSelector } from "@/hooks/useDateSelector";

// Thin, consistently-styled wrapper around a native date input, driven by
// useDateSelector — the one place date-picking behavior (debounced save,
// display formatting) lives, so every date field in the app behaves and
// looks the same instead of each screen rolling its own <input type="date">.
// `unstyled` drops the default box chrome (border/background/padding) for
// dense contexts that need to fully own the input's look via `className` —
// appending classes can't reliably beat Tailwind's own utilities on the
// same property, since precedence follows generated CSS order, not the
// order classes appear in the string.
export default function DateField({ value, onSave, className = "", unstyled = false, ...props }) {
  const { date, handleChange } = useDateSelector(value, onSave);

  const base = unstyled
    ? "outline-none"
    : "text-sm px-2 py-1.5 bg-background border border-input rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <input
      type="date"
      value={date}
      onChange={handleChange}
      className={`${base} ${className}`}
      {...props}
    />
  );
}
