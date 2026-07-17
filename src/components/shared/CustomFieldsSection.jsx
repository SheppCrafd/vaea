import { useState } from "react";
import { X, Plus } from "lucide-react";
import EditableText from "@/components/shared/EditableText";
import { slugifyFieldKey, getMergedCustomFields, getAreaCustomFields } from "@/lib/customFields";

// Lets a user add an arbitrary field to an entity (Project, Product, or
// Area): a label + value, scoped either to just this entity or — when a
// parent `area` is supplied — registered on the Area so it's available
// (empty, fillable) on every other entity of the same type in that area too.
// Each field can optionally be flagged to also render on the card via
// `display_on_card_fields`.
export default function CustomFieldsSection({
  entity,
  entityType = "project",
  area,
  onUpdateEntity,
  onUpdateArea,
  areaScopeLabel = "All projects in this area",
  entityScopeLabel = "This one only",
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState("entity"); // "entity" | "area"
  const [showOnCard, setShowOnCard] = useState(false);

  const fields = getMergedCustomFields(entity, area, entityType);
  const displayFields = entity.display_on_card_fields || [];

  const saveFieldValue = (key, fieldLabel, newValue) => {
    onUpdateEntity({
      custom_data: { ...entity.custom_data, [key]: { label: fieldLabel, value: newValue } },
    });
  };

  const toggleCardDisplay = (key) => {
    const next = displayFields.includes(key)
      ? displayFields.filter((k) => k !== key)
      : [...displayFields, key];
    onUpdateEntity({ display_on_card_fields: next });
  };

  const removeField = (key) => {
    const nextData = { ...entity.custom_data };
    delete nextData[key];
    onUpdateEntity({
      custom_data: nextData,
      display_on_card_fields: displayFields.filter((k) => k !== key),
    });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!label.trim()) return;

    const key = slugifyFieldKey(label.trim(), fields.map((f) => f.key));

    onUpdateEntity({
      custom_data: { ...entity.custom_data, [key]: { label: label.trim(), value: value.trim() } },
      display_on_card_fields: showOnCard ? [...displayFields, key] : displayFields,
    });

    if (scope === "area" && area) {
      onUpdateArea({
        custom_schema: {
          ...area.custom_schema,
          [`${entityType}_fields`]: [...getAreaCustomFields(area, entityType), { key, label: label.trim() }],
        },
      });
    }

    setLabel("");
    setValue("");
    setScope("entity");
    setShowOnCard(false);
    setIsAdding(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Fields</p>
        <button
          onClick={() => setIsAdding((v) => !v)}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-md hover:opacity-80"
        >
          <Plus className="w-3 h-3" /> Add Field
        </button>
      </div>

      {fields.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground mb-2">No custom fields yet.</p>
      )}

      {fields.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center gap-2 bg-secondary/20 border border-border rounded px-2 py-1.5">
              <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate" title={f.label}>
                {f.label}
              </span>
              <EditableText
                value={f.value}
                onSave={(val) => saveFieldValue(f.key, f.label, val)}
                placeholder="—"
                className="text-xs flex-1"
              />
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0" title="Show on card">
                <input type="checkbox" checked={displayFields.includes(f.key)} onChange={() => toggleCardDisplay(f.key)} />
                Card
              </label>
              <button onClick={() => removeField(f.key)} aria-label="Remove field" className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-secondary/20 border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Field name"
              autoFocus
              className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
            />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value (optional)"
              className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
            />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="text-xs bg-background border border-border rounded px-1.5 py-1.5 outline-none"
              >
                <option value="entity">{entityScopeLabel}</option>
                {area && <option value="area">{areaScopeLabel}</option>}
              </select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={showOnCard} onChange={(e) => setShowOnCard(e.target.checked)} />
                Show on card
              </label>
            </div>
            <button type="submit" disabled={!label.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50">
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
