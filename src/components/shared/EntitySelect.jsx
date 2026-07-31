// The plain <select> styling shared by every relationship dropdown across
// the create-entity forms — was identical markup retyped at every select.
// Accepts either `options` (the common "map entities to <option>s, with a
// placeholder" case) or raw `children` (TaskForm's quadrant select renders
// <QuadrantOptions/> directly, which isn't a plain value/label array).
export default function EntitySelect({ id, value, onChange, disabled, placeholder, options, children }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
}
