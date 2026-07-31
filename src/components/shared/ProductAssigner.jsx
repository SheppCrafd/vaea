import { Link2 } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import MultiSelectPopover from "@/components/shared/MultiSelectPopover";

// Multi-select for a project's `related_product_ids` — products this project
// serves in addition to its primary parent (rendered as connector lines on
// the dashboard by ProductConnectionLines). `excludeProductId` keeps the
// project's own parent out of the list, since that relationship is already
// implied by nesting.
export default function ProductAssigner({
  currentProductIds = [],
  allProducts = [],
  excludeProductId = null,
  onSave,
}) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });

  const selectableProducts = allProducts.filter((p) => p.id !== excludeProductId);
  const linked = selectableProducts.filter((p) => currentProductIds.includes(p.id));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground border border-border hover:opacity-80 transition-opacity"
      >
        <Link2 className="w-3 h-3" />
        {linked.length === 0 ? "Connect Products" : `${linked.length} connected`}
      </button>

      <MultiSelectPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        className="w-56"
        headerLabel="Related Products"
        items={selectableProducts}
        getId={(p) => p.id}
        getLabel={(p) => <span>{p.title}</span>}
        selectedIds={currentProductIds}
        onSave={onSave}
        emptyMessage="No other products yet."
      />
    </>
  );
}
