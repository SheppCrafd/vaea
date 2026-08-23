import { cn } from "@/lib/utils";

// The one plain <select> used everywhere in the app — was identical markup
// (or near-identical, with drifted padding/font-size) retyped at every
// select instead of shared. Accepts either `options` (map value/label pairs,
// with an optional placeholder) or raw `children` (a caller that needs
// <option>s it doesn't control the shape of, e.g. QuadrantOptions).
export function Select({ id, value, onChange, disabled, placeholder, options, children, className, ...props }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn("w-full text-sm px-3 py-2 bg-background border border-input rounded-md disabled:opacity-50", className)}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
}
