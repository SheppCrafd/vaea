// Label+control wrapper shared by every create-entity form (AreaForm,
// ProductForm, ProjectForm, TaskForm) — was identical markup retyped at
// every field across all four.
export default function FormField({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}
