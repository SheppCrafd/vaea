// Bulk CSV import for the Create New popover's "Via .csv" tab: ONE template,
// not one per entity type. Every row can describe the full parent/child path
// down to whatever leaf it's adding — area, then optionally product, then
// optionally project, then optionally task — leaving deeper columns blank
// once you've reached the level you're creating. Rows that repeat the same
// area/product/project title are treated as the same record (reused, not
// duplicated) — across rows in the same file, and against whatever already
// exists in the live workspace.
//
import { sortByPosition } from "@/lib/entityUtils";

// This mirrors exactly how the AI chat assistant's own multi-step plans work
// (base44/functions/aiChatStream's [MULTI-STEP PLANS] + chatActions.js's
// resolvePlaceholders): a newly-created row-level entity is referenced by a
// "$temp_id" placeholder string until executeActionSequence actually creates
// it and resolves that placeholder to a real id. Reusing that exact
// mechanism means there's no second id-resolution implementation here.

export const CSV_TEMPLATE_COLUMNS = [
  "area_title", "area_description",
  "product_title", "product_description",
  "project_title", "project_description",
  "task_description",
];

// Demonstrates the pattern itself: repeat a title to attach to the same
// parent, leave a column blank once you've reached the level you're adding.
export const CSV_TEMPLATE_EXAMPLE_ROWS = [
  { area_title: "Home", area_description: "Personal life admin", product_title: "", product_description: "", project_title: "", project_description: "", task_description: "" },
  { area_title: "Home", area_description: "", product_title: "Renovation", product_description: "Home renovation projects", project_title: "", project_description: "", task_description: "" },
  { area_title: "Home", area_description: "", product_title: "Renovation", product_description: "", project_title: "Kitchen remodel", project_description: "Redo the kitchen", task_description: "" },
  { area_title: "Home", area_description: "", product_title: "Renovation", product_description: "", project_title: "Kitchen remodel", project_description: "", task_description: "Book contractor" },
  { area_title: "Home", area_description: "", product_title: "", product_description: "", project_title: "Standalone project", project_description: "", task_description: "" },
  { area_title: "Home", area_description: "", product_title: "", product_description: "", project_title: "Standalone project", project_description: "", task_description: "Call plumber" },
];

// The downloaded "template" is really a workspace export: one row per
// current active entity, in the same hierarchical format the importer
// reads. Because the importer reuses records whose titles already exist,
// re-importing an unmodified download is a clean no-op — the file is
// simultaneously a full inventory, a backup, and a scaffold to add rows to.
// Callers pass ACTIVE entities only (the entity hooks already exclude
// soft-deleted and archived records); an empty workspace falls back to
// CSV_TEMPLATE_EXAMPLE_ROWS at the call site.
export function buildWorkspaceRows({ areas = [], products = [], projects = [], tasks = [] }) {
  const blank = Object.fromEntries(CSV_TEMPLATE_COLUMNS.map((c) => [c, ""]));
  const rows = [];

  const pushProject = (area, product, project) => {
    rows.push({
      ...blank,
      area_title: area.title || "",
      product_title: product?.title || "",
      project_title: project.title || "",
      project_description: project.objective || "",
    });
    for (const task of tasks.filter((t) => t.project_id === project.id)) {
      rows.push({
        ...blank,
        area_title: area.title || "",
        product_title: product?.title || "",
        project_title: project.title || "",
        task_description: task.description || "",
      });
    }
  };

  for (const area of sortByPosition(areas)) {
    rows.push({ ...blank, area_title: area.title || "", area_description: area.description || "" });
    const areaProducts = sortByPosition(products.filter((p) => p.parent_area_id === area.id));
    const areaProductIds = new Set(areaProducts.map((p) => p.id));
    for (const product of areaProducts) {
      rows.push({
        ...blank,
        area_title: area.title || "",
        product_title: product.title || "",
        product_description: product.description || "",
      });
      for (const project of sortByPosition(projects.filter((pr) => pr.parent_product_id === product.id))) {
        pushProject(area, product, project);
      }
    }
    // Direct projects — including ones whose parent product isn't in the
    // active set (archived/deleted parent), which would otherwise vanish
    // from the export entirely.
    const directProjects = sortByPosition(
      projects.filter((pr) => pr.parent_area_id === area.id && (!pr.parent_product_id || !areaProductIds.has(pr.parent_product_id)))
    );
    for (const project of directProjects) pushProject(area, null, project);
  }

  return rows;
}

const AMBIGUOUS = Symbol("ambiguous");
const norm = (title) => title.trim().toLowerCase();

function seedMap(list, keyFor) {
  const map = new Map();
  for (const item of list) {
    const key = keyFor(item);
    map.set(key, map.has(key) ? AMBIGUOUS : item.id);
  }
  return map;
}

// Builds an ordered action plan (CREATE_AREA/CREATE_PRODUCT/CREATE_PROJECT/
// CREATE_TASK, with temp_id chaining) from the parsed CSV rows, ready to run
// through chatActions.js's executeActionSequence. Validation happens here,
// row by row, before anything is added to the plan — a row that fails is
// reported with a specific reason and simply contributes no actions; it
// doesn't stop later rows (including ones that depend on an *earlier*,
// successfully-resolved row) from still being processed.
export function buildHierarchyPlan(records, ctx) {
  const areaMap = seedMap(ctx.areas, (a) => norm(a.title));
  const productMap = seedMap(ctx.products, (p) => `${p.parent_area_id}::${norm(p.title)}`);
  const projectMap = seedMap(ctx.projects, (p) => `${p.parent_area_id}::${p.parent_product_id || ""}::${norm(p.title)}`);
  // Tasks follow the same "repeating an existing row reuses, never
  // duplicates" contract as every level above — essential now that the
  // downloaded template arrives pre-filled with the current workspace, so
  // importing it back unedited is a clean no-op instead of doubling every
  // task. Also catches the same task row repeated within one file.
  const taskSet = new Set((ctx.tasks || []).map((t) => `${t.project_id}::${norm(t.description || "")}`));

  const actions = [];
  const errors = [];
  let tempCounter = 0;
  const nextTempId = (prefix) => `imp_${prefix}_${tempCounter++}`;

  records.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1, data starts at row 2
    const areaTitle = (row.area_title || "").trim();
    const productTitle = (row.product_title || "").trim();
    const projectTitle = (row.project_title || "").trim();
    const taskDescription = (row.task_description || "").trim();

    if (!areaTitle && !productTitle && !projectTitle && !taskDescription) return; // fully blank row

    if (!areaTitle) {
      errors.push({ row: rowNum, error: "area_title is required on any row that fills in another column" });
      return;
    }

    const areaKey = norm(areaTitle);
    let areaRef = areaMap.get(areaKey);
    if (areaRef === AMBIGUOUS) {
      errors.push({ row: rowNum, error: `multiple existing areas already match "${areaTitle}" — rename one to be unique` });
      return;
    }
    if (!areaRef) {
      const tempId = nextTempId("area");
      actions.push({ action: "CREATE_AREA", args: { title: areaTitle, description: row.area_description || "" }, temp_id: tempId });
      areaRef = `$${tempId}`;
      areaMap.set(areaKey, areaRef);
    }

    if (!productTitle && !projectTitle && !taskDescription) return; // leaf was the area

    let productRef = null;
    if (productTitle) {
      const productKey = `${areaRef}::${norm(productTitle)}`;
      productRef = productMap.get(productKey);
      if (productRef === AMBIGUOUS) {
        errors.push({ row: rowNum, error: `multiple existing products already match "${productTitle}" in area "${areaTitle}" — rename one to be unique` });
        return;
      }
      if (!productRef) {
        const tempId = nextTempId("product");
        actions.push({
          action: "CREATE_PRODUCT",
          args: { parent_area_id: areaRef, title: productTitle, description: row.product_description || "" },
          temp_id: tempId,
        });
        productRef = `$${tempId}`;
        productMap.set(productKey, productRef);
      }
    }

    if (!projectTitle && !taskDescription) return; // leaf was the product

    if (!projectTitle) {
      errors.push({ row: rowNum, error: "project_title is required when task_description is filled in" });
      return;
    }

    const projectKey = `${areaRef}::${productRef || ""}::${norm(projectTitle)}`;
    let projectRef = projectMap.get(projectKey);
    if (projectRef === AMBIGUOUS) {
      errors.push({ row: rowNum, error: `multiple existing projects already match "${projectTitle}" under that same area/product — rename one to be unique` });
      return;
    }
    if (!projectRef) {
      const tempId = nextTempId("project");
      actions.push({
        action: "CREATE_PROJECT",
        args: { parent_area_id: areaRef, parent_product_id: productRef, title: projectTitle, objective: row.project_description || "" },
        temp_id: tempId,
      });
      projectRef = `$${tempId}`;
      projectMap.set(projectKey, projectRef);
    }

    if (!taskDescription) return; // leaf was the project

    const taskKey = `${projectRef}::${norm(taskDescription)}`;
    if (taskSet.has(taskKey)) return; // this exact task already exists under that project
    taskSet.add(taskKey);
    actions.push({ action: "CREATE_TASK", args: { project_id: projectRef, description: taskDescription } });
  });

  return { actions, errors };
}

// Tallies how many of each entity type a plan will actually create — a
// single row can create up to four records at once (a brand-new area with a
// brand-new product/project/task all in one go), so "rows imported" isn't a
// meaningful count; "N areas, N products, ..." is.
export function countActionsByType(actions) {
  const counts = { area: 0, product: 0, project: 0, task: 0 };
  const actionToKey = { CREATE_AREA: "area", CREATE_PRODUCT: "product", CREATE_PROJECT: "project", CREATE_TASK: "task" };
  for (const action of actions) {
    const key = actionToKey[action.action];
    if (key) counts[key] += 1;
  }
  return counts;
}
