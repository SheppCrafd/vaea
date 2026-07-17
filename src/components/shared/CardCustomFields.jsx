import EditableText from "@/components/shared/EditableText";

// Renders an entity's custom fields flagged `display_on_card_fields` as
// inline-editable "Label: value" pairs — the compact card-face echo of
// CustomFieldsSection's full editor in the expand modal. Shared by
// Project/Product/AreaCard so the identical field-lookup+save logic isn't
// hand-copied three times; each card still owns its own wrapper layout via
// `className`.
export default function CardCustomFields({ entity, onUpdateEntity, className }) {
  const displayFields = entity.display_on_card_fields || [];
  if (displayFields.length === 0) return null;

  const saveFieldValue = (key, label, value) => {
    onUpdateEntity({ custom_data: { ...entity.custom_data, [key]: { label, value } } });
  };

  return (
    <div className={className}>
      {displayFields.map((key) => {
        const field = entity.custom_data?.[key];
        if (!field) return null;
        return (
          <span key={key} className="text-[10px] text-muted-foreground flex items-center gap-1 min-w-0">
            <span className="font-medium text-foreground shrink-0">{field.label}:</span>
            <EditableText
              value={field.value}
              onSave={(val) => saveFieldValue(key, field.label, val)}
              placeholder="—"
              className="text-[10px] w-auto"
            />
          </span>
        );
      })}
    </div>
  );
}
