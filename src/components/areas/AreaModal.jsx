import { useEffect } from "react";
import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useAreas, useUpdateArea } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useFilter } from "@/lib/FilterContext";
import { sortByPosition } from "@/lib/entityUtils";
import EditableText from "@/components/shared/EditableText";
import CustomFieldsSection from "@/components/shared/CustomFieldsSection";
import ProductCard from "@/components/products/ProductCard";
import ProjectCardFull from "@/components/projects/ProjectCardFull";

export default function AreaModal({ area, onClose }) {
  const { data: allAreas = [] } = useAreas();
  const { data: allProducts = [] } = useProducts();
  const { data: allProjects = [] } = useProjects();
  const { excludedIds } = useFilter();
  const updateArea = useUpdateArea();

  // `area` is a snapshot from the moment the card was expanded — re-resolve
  // against the live query so edits made in this view (title, description,
  // custom fields) show up immediately instead of only after reopening.
  const liveArea = allAreas.find((a) => a.id === area.id) || area;

  const products = sortByPosition(allProducts.filter((p) => p.parent_area_id === area.id && !excludedIds.includes(p.id)));
  const standaloneProjects = allProjects.filter(
    (p) => p.parent_area_id === area.id && !p.parent_product_id && !excludedIds.includes(p.id)
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnBackdropClick={false}
      label={liveArea.title}
      overlayClassName="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
        <div className="flex items-start justify-between gap-3 p-6 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex-1 min-w-0">
            <EditableText
              value={liveArea.title}
              onSave={(v) => updateArea.mutate({ id: area.id, data: { title: v } })}
              aria-label="Area title"
              className="font-heading text-xl font-semibold"
            />
            <EditableText
              value={liveArea.description}
              onSave={(v) => updateArea.mutate({ id: area.id, data: { description: v } })}
              multiline
              placeholder="Add a description..."
              aria-label="Area description"
              className="text-sm text-muted-foreground mt-1"
            />
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-6">
            <CustomFieldsSection
              entity={liveArea}
              entityType="area"
              onUpdateEntity={(data) => updateArea.mutate({ id: area.id, data })}
              entityScopeLabel="This area"
            />
          </div>

          {products.length === 0 && standaloneProjects.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-sm">No products or projects yet. Click "Create New" to add one to this area.</p>
            </div>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} forceFullProjects />
              ))}
              {standaloneProjects.map((project) => (
                <ProjectCardFull key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
    </Modal>
  );
}
