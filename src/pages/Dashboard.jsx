import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useFilter } from "@/lib/FilterContext";
import AreaCard from "@/components/areas/AreaCard";
import AreaModal from "@/components/areas/AreaModal";
import CreateModal from "@/components/modals/CreateModal";

export default function Dashboard() {
  const { data: areas = [], isLoading: areasLoading } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const updateProject = useUpdateProject();
  const { excludedIds } = useFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedArea, setExpandedArea] = useState(null);

  // Deep link: ?areaId={id} reopens the matching area on direct visit.
  useEffect(() => {
    const areaId = searchParams.get("areaId");
    if (areaId && areas.length && !expandedArea) {
      const match = areas.find((a) => a.id === areaId);
      if (match) setExpandedArea(match);
    }
  }, [searchParams, areas, expandedArea]);

  const handleExpand = (area) => {
    setExpandedArea(area);
    setSearchParams({ areaId: area.id });
  };

  const handleClose = () => {
    setExpandedArea(null);
    searchParams.delete("areaId");
    setSearchParams(searchParams);
  };

  // Drag and Drop Handler
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    // If dropped outside a valid drop zone
    if (!over) return;

    const projectId = active.id;
    const newParentProductId = over.id; 

    // Find the project being moved
    const project = projects.find(p => p.id === projectId);
    
    // Only update if it actually changed products
    if (project && project.parent_product_id !== newParentProductId) {
      updateProject.mutate({
        id: projectId,
        data: { parent_product_id: newParentProductId }
      });
    }
  };

  if (areasLoading) {
    return <div className="text-sm text-muted-foreground">Loading areas...</div>;
  }

  const visibleAreas = areas.filter((a) => !excludedIds.includes(a.id));

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div>
        <h1 className="font-heading text-2xl font-semibold mb-6">Areas of Responsibility</h1>
        {visibleAreas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No areas found. Click "Create New" to add your first Area of Responsibility.</p>
          </div>
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}
          >
            {visibleAreas.map((area) => {
              // Group products and projects for this specific Area
              const areaProducts = products.filter((p) => p.parent_area_id === area.id);
              
              // Map projects into their parent products
              const productsWithProjects = areaProducts.map((product) => ({
                ...product,
                projects: projects.filter((proj) => proj.parent_product_id === product.id)
              }));

              // Find projects that belong to the Area directly (no parent product)
              const orphanProjects = projects.filter(
                (proj) => proj.parent_area_id === area.id && !proj.parent_product_id
              );

              return (
                <AreaCard
                  key={area.id}
                  area={area}
                  products={productsWithProjects}
                  orphanProjects={orphanProjects}
                  onExpand={() => handleExpand(area)}
                  productCount={areaProducts.length}
                  stakeholderIds={areaProducts.flatMap((p) => p.stakeholder_ids || [])}
                />
              );
            })}
          </div>
        )}
        <CreateModal />
        {expandedArea && (
          <AreaModal area={expandedArea} onClose={handleClose} />
        )}
      </div>
    </DndContext>
  );
}
