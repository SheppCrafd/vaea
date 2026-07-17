import { Check, Link2 } from "lucide-react";
import Portal from "@/lib/Portal";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";

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

  const toggleProduct = (id) => {
    const newIds = currentProductIds.includes(id)
      ? currentProductIds.filter((existingId) => existingId !== id)
      : [...currentProductIds, id];
    onSave(newIds);
  };

  const linked = selectableProducts.filter((p) => currentProductIds.includes(p.id));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:opacity-80 transition-opacity"
      >
        <Link2 className="w-3 h-3" />
        {linked.length === 0 ? "Connect Products" : `${linked.length} connected`}
      </button>

      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999]" onClick={close}>
            <div
              className="fixed w-56 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
              style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
                Related Products
              </p>
              {selectableProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-2">No other products yet.</p>
              ) : (
                selectableProducts.map((p) => {
                  const isLinked = currentProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProduct(p.id)}
                      className="w-full text-left px-2 py-1.5 text-xs flex items-center justify-between hover:bg-secondary rounded-sm transition-colors"
                    >
                      <span>{p.title}</span>
                      {isLinked && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
