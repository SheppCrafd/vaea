import { useEffect } from "react";
import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { useStakeholders } from "@/hooks/useStakeholders";
import { useUpdateProduct } from "@/hooks/useProducts";
import EditableText from "@/components/shared/EditableText";

export default function ProductDetailModal({ product, onClose }) {
  const { data: allStakeholders = [] } = useStakeholders();
  const updateProduct = useUpdateProduct();
  const stakeholders = allStakeholders.filter((s) => (product.stakeholder_ids || []).includes(s.id));
  const departments = [...new Set(stakeholders.map((s) => s.department))];

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 p-6 border-b border-border sticky top-0 bg-background z-10">
          <EditableText
            value={product.title}
            onSave={(v) => updateProduct.mutate({ id: product.id, data: { title: v } })}
            className="font-heading text-xl font-semibold"
          />
          <button onClick={onClose} className="shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 max-w-2xl mx-auto space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            <EditableText
              value={product.description}
              onSave={(v) => updateProduct.mutate({ id: product.id, data: { description: v } })}
              multiline
              placeholder="No description yet"
              className="text-sm bg-card border border-border rounded-md p-2"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Stakeholders</p>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stakeholders assigned.</p>
            ) : (
              departments.map((dept) => (
                <div key={dept} className="mb-2">
                  <p className="text-xs text-muted-foreground">{dept}</p>
                  <p className="text-sm break-words">{stakeholders.filter((s) => s.department === dept).map((s) => s.name).join(", ")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}