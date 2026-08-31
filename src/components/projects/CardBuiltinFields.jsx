import { useProducts } from "@/hooks/useProducts";
import EditableText from "@/components/shared/EditableText";
import { METRIC_FIELDS } from "@/lib/projectUtils";

// Built-in project fields that are OFF the card face by default and get
// pulled onto it one at a time via the "Show on card" checkboxes in
// ProjectDetailModal (which write `project.display_on_card_builtins`).
// Mirrors what CardCustomFields does for user-defined custom fields.
export const CARD_BUILTIN_FIELDS = [
  { key: "problem_statement", label: "Problem Statement" },
  { key: "metrics", label: "Impact & Outcome Metrics" },
  { key: "related_products", label: "Related Products" },
];

export default function CardBuiltinFields({ project, onUpdate, className = "" }) {
  const enabled = project.display_on_card_builtins || [];
  const { data: allProducts = [] } = useProducts();

  if (enabled.length === 0) return null;

  const relatedProducts = allProducts.filter((p) => (project.related_product_ids || []).includes(p.id));
  const shownMetrics = METRIC_FIELDS.filter(({ key }) => (project.metrics?.[key] || "").toString().trim());

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {enabled.includes("problem_statement") && (
        <div>
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Problem Statement</p>
          <EditableText
            value={project.problem_statement}
            onSave={(v) => onUpdate({ problem_statement: v })}
            placeholder="No problem statement set"
            className="text-[10px] text-muted-foreground"
            multiline
          />
        </div>
      )}

      {enabled.includes("metrics") && (
        <div>
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Impact &amp; Outcome</p>
          {shownMetrics.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {shownMetrics.map(({ key, label }) => (
                <span key={key} className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">{label}:</span> {project.metrics[key]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {enabled.includes("related_products") && (
        <div>
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Related Products</p>
          {relatedProducts.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {relatedProducts.map((p) => (
                <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {p.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
