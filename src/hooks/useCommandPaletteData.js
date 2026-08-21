import { useMemo } from "react";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { useStakeholders } from "@/hooks/useStakeholders";
import { TABS } from "@/lib/tabs";

// Every tab in the header bar, as its own searchable/quick-click result —
// same list Header.jsx renders, so a new tab added there shows up here for
// free. "Page" results skip a subtitle entirely (CommandPalette.jsx renders
// them as just their own header/label, nothing else) since the title alone
// already says what they are.
const pageItems = TABS.map((t) => ({ type: "page", id: t.key, title: t.label, subtitle: null, Icon: t.Icon, url: t.to }));

// One flat, typed list the command palette filters client-side against.
// Every entity hook here already has staleTime: Infinity and is normally
// mounted somewhere in the tree anyway (Dashboard, LeftSidebar, etc.) — React
// Query dedupes by queryKey, so mounting the palette doesn't add a second
// fetch, just a second subscriber to the same cached data.
export function useCommandPaletteData() {
  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();
  const { data: stakeholders = [] } = useStakeholders();

  return useMemo(() => {
    const productsById = new Map(products.map((p) => [p.id, p]));
    const projectsById = new Map(projects.map((p) => [p.id, p]));

    const areaItems = areas.map((a) => ({
      type: "area", id: a.id, title: a.title || "Untitled area", subtitle: a.description || "Area",
    }));
    const productItems = products.map((p) => ({
      type: "product", id: p.id, title: p.title || "Untitled product", subtitle: p.description || "Product",
      areaId: p.parent_area_id,
    }));
    const projectItems = projects.map((p) => ({
      type: "project", id: p.id, title: p.title || "Untitled project", subtitle: p.objective || "Project",
      areaId: p.parent_area_id, productId: p.parent_product_id,
    }));
    // A task's own "detail view" is its parent project's expand modal — there's
    // no standalone task screen anywhere else in the app either.
    const taskItems = tasks.map((t) => {
      const project = projectsById.get(t.project_id);
      const product = project?.parent_product_id ? productsById.get(project.parent_product_id) : null;
      return {
        type: "task",
        id: t.id,
        projectId: t.project_id,
        title: t.description || "Untitled task",
        subtitle: project ? `Task in ${project.title}` : "Task",
        productId: product?.id,
        areaId: project?.parent_area_id,
      };
    });
    const stakeholderItems = stakeholders.map((s) => ({
      type: "stakeholder", id: s.id, title: s.name || "Unnamed stakeholder", subtitle: s.department ? `Stakeholder · ${s.department}` : "Stakeholder",
    }));

    return [...pageItems, ...areaItems, ...productItems, ...projectItems, ...taskItems, ...stakeholderItems];
  }, [areas, products, projects, tasks, stakeholders]);
}
