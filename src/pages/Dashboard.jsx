import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Boxes, Filter, Plus } from "lucide-react";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useFilter } from "@/lib/FilterContext";
import { sortByPosition } from "@/lib/entityUtils";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import AreaCard from "@/components/areas/AreaCard";
import AreaCardSkeleton from "@/components/areas/AreaCardSkeleton";
import ProductConnectionLines from "@/components/products/ProductConnectionLines";
import QueryError from "@/components/shared/QueryError";

// Lazy: none of these four render until a user action (Create, or expanding
// an Area/Product/Project), so they don't need to be in Dashboard's initial
// bundle — the route everyone hits first.
const AreaModal = lazy(() => import("@/components/areas/AreaModal"));
const CreateModal = lazy(() => import("@/components/modals/CreateModal"));
const ProductDetailModal = lazy(() => import("@/components/products/ProductDetailModal"));
const ProjectDetailModal = lazy(() => import("@/components/projects/ProjectDetailModal"));

export default function Dashboard() {
  const { data: areas = [], isLoading: areasLoading, isError: areasError, error: areasErrorObj, refetch: refetchAreas } = useAreas();
  const { data: products = [], isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts();
  const { data: projects = [], isError: projectsError, error: projectsErrorObj, refetch: refetchProjects } = useProjects();
  const { excludedIds, includeMany } = useFilter();
  const openCreateModal = useAppStore((s) => s.openCreateModal);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedArea, setExpandedArea] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);

  // Three independent deep-link params (?areaId=/?productId=/?projectId=),
  // each opening the matching detail modal directly — how the command
  // palette (and anything else) jumps straight to a nested Product/Project
  // without walking the card hierarchy by hand. Only ?areaId= existed
  // before this; Product/Project didn't need their own modal-opening path
  // until something other than a card's own expand icon needed to reach them.
  useEffect(() => {
    const areaId = searchParams.get("areaId");
    if (areaId && areas.length && !expandedArea) {
      const match = areas.find((a) => a.id === areaId);
      if (match) setExpandedArea(match);
    }
    const productId = searchParams.get("productId");
    if (productId && products.length && !expandedProduct) {
      const match = products.find((p) => p.id === productId);
      if (match) setExpandedProduct(match);
    }
    const projectId = searchParams.get("projectId");
    if (projectId && projects.length && !expandedProject) {
      const match = projects.find((p) => p.id === projectId);
      if (match) setExpandedProject(match);
    }
  }, [searchParams, areas, products, projects, expandedArea, expandedProduct, expandedProject]);

  // Stable across renders (useCallback) so AreaCard's React.memo isn't
  // defeated by a fresh function identity every Dashboard render — it takes
  // the area itself as an argument rather than closing over it.
  const handleExpand = useCallback((area) => {
    setExpandedArea(area);
    setSearchParams({ areaId: area.id });
  }, [setSearchParams]);

  const handleClose = () => {
    setExpandedArea(null);
    searchParams.delete("areaId");
    setSearchParams(searchParams);
  };

  const handleCloseProduct = () => {
    setExpandedProduct(null);
    searchParams.delete("productId");
    setSearchParams(searchParams);
  };

  const handleCloseProject = () => {
    setExpandedProject(null);
    searchParams.delete("projectId");
    setSearchParams(searchParams);
  };

  // Per-area derived data (which products/projects belong to it, and the
  // aggregated stakeholder ids for highlight matching) only actually needs
  // to be recomputed when the underlying query data or the exclusion filter
  // changes — not on every Dashboard re-render (e.g. toggling the expanded
  // area, or a search-param change). Memoizing this also gives each AreaCard
  // stable prop references across unrelated re-renders.
  const visibleAreas = useMemo(
    () => sortByPosition(areas.filter((a) => !excludedIds.includes(a.id))),
    [areas, excludedIds]
  );

  const areaViewModels = useMemo(
    () =>
      visibleAreas.map((area) => {
        const areaProducts = sortByPosition(products.filter((p) => p.parent_area_id === area.id));

        const productsWithProjects = areaProducts.map((product) => ({
          ...product,
          projects: sortByPosition(projects.filter((proj) => proj.parent_product_id === product.id))
        }));

        const orphanProjects = sortByPosition(
          projects.filter((proj) => proj.parent_area_id === area.id && !proj.parent_product_id)
        );

        // Areas have no stakeholder_ids of their own, so an Area's
        // highlight state is entirely inherited from its subtree. This
        // must include every level underneath it — not just direct
        // products — or a stakeholder assigned to a nested project (or
        // an orphan project with no product parent) would dim the Area
        // card while the very card containing them stays undimmed.
        const areaStakeholderIds = [
          ...areaProducts.flatMap((p) => p.stakeholder_ids || []),
          ...productsWithProjects.flatMap((p) => p.projects.flatMap((proj) => proj.stakeholder_ids || [])),
          ...orphanProjects.flatMap((p) => p.stakeholder_ids || []),
        ];

        return { area, productsWithProjects, orphanProjects, areaStakeholderIds };
      }),
    [visibleAreas, products, projects]
  );

  if (areasLoading) {
    return (
      <div className="grid grid-cols-1 items-start gap-5">
        <AreaCardSkeleton />
        <AreaCardSkeleton />
        <AreaCardSkeleton />
      </div>
    );
  }

  if (areasError || productsError || projectsError) {
    const firstError = areasErrorObj || productsErrorObj || projectsErrorObj;
    const retry = () => {
      if (areasError) refetchAreas();
      if (productsError) refetchProducts();
      if (projectsError) refetchProjects();
    };
    return <QueryError error={firstError} onRetry={retry} label="Couldn't load the dashboard." />;
  }

  return (
    <div>
      {areaViewModels.length === 0 ? (
        areas.length > 0 ? (
          // Areas exist, but the active filter hides every one of them —
          // a different situation from a genuinely empty dashboard (below),
          // and "create one" would be actively wrong advice here. The fix
          // is clearing the filter, not making more areas.
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted text-muted-foreground">
              <Filter className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h2 className="font-heading font-semibold text-foreground">Every area is hidden</h2>
              <p className="text-sm text-muted-foreground">Your current filter is hiding all of them from view.</p>
            </div>
            <Button variant="outline" onClick={() => includeMany(excludedIds)} className="gap-2 rounded-full px-5 mt-1">
              Clear filter
            </Button>
          </div>
        ) : (
          // The true empty state: nothing has been created yet. An icon,
          // a heading, and a direct CTA — an invitation to act, not a
          // one-line pointer to a button elsewhere on screen.
          <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
              <Boxes className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-sm">
              <h2 className="font-heading font-semibold text-lg text-foreground">Start with your first area</h2>
              <p className="text-sm text-muted-foreground">
                Areas of responsibility hold the products and projects you're tracking. Create one to get going.
              </p>
            </div>
            <Button onClick={() => openCreateModal("area")} className="gap-2 rounded-full px-5 mt-1">
              <Plus className="w-4 h-4" />
              Create an Area
            </Button>
          </div>
        )
      ) : (
        <div
          // Areas always stack as a single full-width column, in both card
          // views — unlike Products/Projects one level down, an Area never
          // shares a row with a sibling Area, so it always gets the whole
          // dashboard width to arrange its own Products (which in turn fill
          // it, cascading the same way down to Projects) in.
          className="grid grid-cols-1 items-start gap-5"
        >
          {areaViewModels.map(({ area, productsWithProjects, orphanProjects, areaStakeholderIds }) => (
            <AreaCard
              key={area.id}
              area={area}
              products={productsWithProjects}
              orphanProjects={orphanProjects}
              onExpand={handleExpand}
              stakeholderIds={areaStakeholderIds}
            />
          ))}
        </div>
      )}
      <Suspense fallback={null}>
        <CreateModal />
        {expandedArea && (
          <AreaModal area={expandedArea} onClose={handleClose} />
        )}
        {expandedProduct && (
          <ProductDetailModal product={expandedProduct} onClose={handleCloseProduct} />
        )}
        {expandedProject && (
          <ProjectDetailModal project={expandedProject} onClose={handleCloseProject} />
        )}
      </Suspense>
      <ProductConnectionLines projects={projects} />
    </div>
  );
}
