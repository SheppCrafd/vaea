import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { Checkbox } from "@/components/ui/checkbox";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useFilter } from "@/lib/FilterContext";
import { sortByPosition } from "@/lib/entityUtils";

// Master predicate filter, restructured as the real Area → Product → Project
// tree (the flat per-type lists couldn't express parent/child filtering) with
// Excel's exact checkbox grammar:
//  - a Select All / Unselect All row at the top,
//  - unchecking a parent unchecks its entire subtree,
//  - re-checking part of a subtree shows every ancestor as the grey
//    indeterminate dash — and re-includes those ancestors, since a child
//    can't render inside a hidden parent.
// Clicking an indeterminate box checks its whole subtree (Excel's behavior);
// unchecking an item still pushes its ID into the global exclusion array,
// causing downstream cards to unmount instantly.
export default function FilterModal({ onClose }) {
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { excludedIds, excludeMany, includeMany } = useFilter();

  const excluded = new Set(excludedIds);
  const included = (id) => !excluded.has(id);

  const productIdSet = new Set(products.map((p) => p.id));
  const areaProducts = (areaId) => sortByPosition(products.filter((p) => p.parent_area_id === areaId));
  const productProjects = (productId) => sortByPosition(projects.filter((p) => p.parent_product_id === productId));
  // Direct projects include ones whose parent product is gone (archived /
  // deleted) — same rule the dashboard uses, so the tree matches what renders.
  const directProjects = (areaId) =>
    sortByPosition(projects.filter((p) => p.parent_area_id === areaId && (!p.parent_product_id || !productIdSet.has(p.parent_product_id))));

  const productSubtreeIds = (product) => [product.id, ...productProjects(product.id).map((p) => p.id)];
  const areaSubtreeIds = (area) => [
    area.id,
    ...areaProducts(area.id).flatMap(productSubtreeIds),
    ...directProjects(area.id).map((p) => p.id),
  ];

  const stateOf = (selfId, descendantIds) => {
    if (!included(selfId)) return "unchecked";
    return descendantIds.every(included) ? "checked" : "indeterminate";
  };

  // Excel semantics: a fully-checked box unchecks its whole subtree; an
  // unchecked or indeterminate one checks it all — plus its ancestors, so
  // what was just checked can actually appear.
  const toggleBranch = (state, subtreeIds, ancestorIds = []) => {
    if (state === "checked") excludeMany(subtreeIds);
    else includeMany([...subtreeIds, ...ancestorIds]);
  };

  const toggleLeaf = (id, ancestorIds) => {
    if (included(id)) excludeMany([id]);
    else includeMany([id, ...ancestorIds]);
  };

  const allIds = [...areas.map((a) => a.id), ...products.map((p) => p.id), ...projects.map((p) => p.id)];
  const allState = allIds.every(included) ? "checked" : allIds.some(included) ? "indeterminate" : "unchecked";

  const Row = ({ depth = 0, state, onChange, label }) => (
    <div className="flex items-center gap-2 text-sm py-0.5" style={{ paddingLeft: depth * 18 }}>
      <Checkbox checked={state === "checked"} indeterminate={state === "indeterminate"} onCheckedChange={onChange} aria-label={label} />
      <span className="truncate cursor-pointer" title={label} onClick={onChange}>{label}</span>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} label="Filter" panelClassName="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold">Filter</h3>
        <button onClick={onClose} aria-label="Close filter"><X className="w-4 h-4" /></button>
      </div>

      {allIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to filter yet.</p>
          ) : (
            <>
              <div className="pb-2 mb-2 border-b border-foreground/[0.07]">
                <Row
                  state={allState}
                  onChange={() => (allState === "checked" ? excludeMany(allIds) : includeMany(allIds))}
                  label={allState === "checked" ? "Unselect all" : "Select all"}
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-0.5">
                {sortByPosition(areas).map((area) => {
                  const subtree = areaSubtreeIds(area);
                  const areaState = stateOf(area.id, subtree);
                  return (
                    <div key={area.id}>
                      <Row
                        state={areaState}
                        onChange={() => toggleBranch(areaState, subtree)}
                        label={area.title || "Untitled area"}
                      />
                      {areaProducts(area.id).map((product) => {
                        const productSubtree = productSubtreeIds(product);
                        const productState = stateOf(product.id, productSubtree);
                        return (
                          <div key={product.id}>
                            <Row
                              depth={1}
                              state={productState}
                              onChange={() => toggleBranch(productState, productSubtree, [area.id])}
                              label={product.title || "Untitled product"}
                            />
                            {productProjects(product.id).map((project) => (
                              <Row
                                key={project.id}
                                depth={2}
                                state={included(project.id) ? "checked" : "unchecked"}
                                onChange={() => toggleLeaf(project.id, [product.id, area.id])}
                                label={project.title || "Untitled project"}
                              />
                            ))}
                          </div>
                        );
                      })}
                      {directProjects(area.id).map((project) => (
                        <Row
                          key={project.id}
                          depth={1}
                          state={included(project.id) ? "checked" : "unchecked"}
                          onChange={() => toggleLeaf(project.id, [area.id])}
                          label={project.title || "Untitled project"}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
    </Modal>
  );
}
