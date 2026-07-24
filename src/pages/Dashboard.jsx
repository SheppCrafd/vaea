import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useFilter } from "@/lib/FilterContext";
import { useCardView } from "@/lib/CardViewContext";
import { sortByPosition } from "@/lib/entityUtils";
import AreaCard from "@/components/areas/AreaCard";
import AreaModal from "@/components/areas/AreaModal";
import CreateModal from "@/components/modals/CreateModal";
import ProductConnectionLines from "@/components/products/ProductConnectionLines";
import QueryError from "@/components/shared/QueryError";
import ProductDetailModal from "@/components/products/ProductDetailModal";
import ProjectDetailModal from "@/components/projects/ProjectDetailModal";

export default function Dashboard() {
  const { data: areas = [], isLoading: areasLoading, isError: areasError, error: areasErrorObj, refetch: refetchAreas } = useAreas();
  const { data: products = [], isError: productsError, error: productsErrorObj, refetch: refetchProducts } = useProducts();
  const { data: projects = [], isError: projectsError, error: projectsErrorObj, refetch: refetchProjects } = useProjects();
  const { excludedIds } = useFilter();
  const { cardView, setCardView } = useCardView();
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

  const handleExpand = (area) => {
    setExpandedArea(area);
    setSearchParams({ areaId: area.id });
  };

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
          projects: projects.filter((proj) => proj.parent_product_id === product.id)
        }));

        const orphanProjects = projects.filter(
          (proj) => proj.parent_area_id === area.id && !proj.parent_product_id
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
    return <div className="text-sm text-muted-foreground">Loading areas...</div>;
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
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-heading text-2xl font-semibold">Areas of Responsibility</h1>
        <div className="flex items-center gap-3">
          <div className="shrink-0 inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium">
            <button
              onClick={() => setCardView("mini")}
              aria-pressed={cardView === "mini"}
              className={`px-3 py-1.5 rounded-md transition-colors ${cardView === "mini" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mini Cards
            </button>
            <button
              onClick={() => setCardView("full")}
              aria-pressed={cardView === "full"}
              className={`px-3 py-1.5 rounded-md transition-colors ${cardView === "full" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Full Cards
            </button>
          </div>
          <Link
            to="/app/chat"
            className="shrink-0 inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors shadow-sm"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Ask Vaea Chat
          </Link>
        </div>
      </div>
      {areaViewModels.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-sm">No areas found. Click "Create New" to add your first Area of Responsibility.</p>
        </div>
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
              onExpand={() => handleExpand(area)}
              stakeholderIds={areaStakeholderIds}
            />
          ))}
        </div>
      )}
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
      <ProductConnectionLines projects={projects} />
    </div>
  );
}
