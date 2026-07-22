// Per-entity-type CSV template columns + row -> CREATE_* args mapping, for
// the "Via .csv" bulk-import tab. Deliberately mirrors the CREATE_AREA/
// CREATE_PRODUCT/CREATE_PROJECT/CREATE_TASK arg shapes chatActions.js's
// executeAction already knows how to run — CSV import calls the exact same
// BULK_CREATE action the AI chat assistant uses, so there's one creation
// path, not a second copy of cascade/default logic.
//
// Relational fields (which area/product/project a row belongs to) are
// entered as plain-text titles in the CSV, not internal ids — nobody
// filling in a spreadsheet knows a UUID. Each row is resolved against the
// current local dataset at import time; a title that doesn't match exactly
// one existing record fails that row with a specific reason instead of
// guessing.

import { TYPE_OPTIONS, STATUS_BUCKETS } from "@/lib/taskUtils";

const STATUS_KEYS = STATUS_BUCKETS.map((b) => b.key);
const TRUTHY_VALUES = new Set(["true", "yes", "y", "1"]);
const isTruthy = (v) => TRUTHY_VALUES.has(String(v ?? "").trim().toLowerCase());

// Finds the one record in `list` whose title matches `title` (case-
// insensitive, trimmed). Returns null for zero matches; for 2+ matches,
// returns a stand-in object with `ambiguous: true` so callers can surface a
// "which one?" error instead of silently picking the first.
function findOneByTitle(list, title) {
  const needle = title.trim().toLowerCase();
  const matches = list.filter((item) => (item.title || "").trim().toLowerCase() === needle);
  if (matches.length === 0) return null;
  if (matches.length > 1) return { ambiguous: true };
  return matches[0];
}

export const CSV_SCHEMAS = {
  area: {
    label: "Area",
    columns: ["title", "description"],
    example: { title: "Home", description: "Personal life admin" },
    buildArgs: (row) => {
      if (!row.title) return { error: "title is required" };
      return { args: { title: row.title, description: row.description || "" } };
    },
  },

  product: {
    label: "Product",
    columns: ["title", "area", "description"],
    example: { title: "Renovation", area: "Home", description: "" },
    buildArgs: (row, ctx) => {
      if (!row.title) return { error: "title is required" };
      if (!row.area) return { error: "area is required" };
      const area = findOneByTitle(ctx.areas, row.area);
      if (!area) return { error: `no area found matching "${row.area}"` };
      if (area.ambiguous) return { error: `multiple areas match "${row.area}" — rename to be unique` };
      return { args: { parent_area_id: area.id, title: row.title, description: row.description || "" } };
    },
  },

  project: {
    label: "Project",
    columns: ["title", "area", "product", "objective", "problem_statement", "owner_name", "due_date", "due_date_status"],
    example: {
      title: "Kitchen remodel", area: "Home", product: "Renovation", objective: "",
      problem_statement: "", owner_name: "", due_date: "", due_date_status: "ESTIMATED",
    },
    buildArgs: (row, ctx) => {
      if (!row.title) return { error: "title is required" };
      if (!row.area) return { error: "area is required" };
      const area = findOneByTitle(ctx.areas, row.area);
      if (!area) return { error: `no area found matching "${row.area}"` };
      if (area.ambiguous) return { error: `multiple areas match "${row.area}" — rename to be unique` };

      let parentProductId = null;
      if (row.product) {
        const scoped = ctx.products.filter((p) => p.parent_area_id === area.id);
        const product = findOneByTitle(scoped, row.product);
        if (!product) return { error: `no product found matching "${row.product}" in area "${row.area}"` };
        if (product.ambiguous) return { error: `multiple products named "${row.product}" in area "${row.area}" — rename to be unique` };
        parentProductId = product.id;
      }

      const dueDateStatus = row.due_date_status ? row.due_date_status.toUpperCase() : "ESTIMATED";
      if (!["ESTIMATED", "COMMITTED"].includes(dueDateStatus)) {
        return { error: `due_date_status must be ESTIMATED or COMMITTED, got "${row.due_date_status}"` };
      }

      return {
        args: {
          parent_area_id: area.id,
          parent_product_id: parentProductId,
          title: row.title,
          objective: row.objective || "",
          problem_statement: row.problem_statement || "",
          owner_name: row.owner_name || "",
          due_date: row.due_date || "",
          due_date_status: dueDateStatus,
        },
      };
    },
  },

  task: {
    label: "Task",
    columns: ["description", "project", "area", "product", "quadrant", "type", "status", "notes", "is_highly_important", "is_quick_task", "is_weekly_focus"],
    example: {
      description: "Book contractor", project: "Kitchen remodel", area: "Home", product: "Renovation",
      quadrant: "1", type: "OTHER", status: "NOT_STARTED", notes: "",
      is_highly_important: "no", is_quick_task: "no", is_weekly_focus: "no",
    },
    buildArgs: (row, ctx) => {
      if (!row.description) return { error: "description is required" };
      if (!row.project) return { error: "project is required" };

      // Project titles aren't guaranteed unique across the whole workspace
      // (two different areas can each have a "Project 1") — narrow by
      // area/product first if given, then require the remaining match to be
      // exactly one, rather than ever guessing among several.
      const needle = row.project.trim().toLowerCase();
      let candidates = ctx.projects.filter((p) => (p.title || "").trim().toLowerCase() === needle);

      if (row.area) {
        const area = findOneByTitle(ctx.areas, row.area);
        if (!area) return { error: `no area found matching "${row.area}"` };
        if (!area.ambiguous) candidates = candidates.filter((p) => p.parent_area_id === area.id);
      }
      if (row.product) {
        const productNeedle = row.product.trim().toLowerCase();
        const productMatches = ctx.products.filter((p) => (p.title || "").trim().toLowerCase() === productNeedle);
        if (productMatches.length === 1) {
          candidates = candidates.filter((p) => p.parent_product_id === productMatches[0].id);
        }
      }

      if (candidates.length === 0) {
        return { error: `no project found matching "${row.project}"${row.area ? ` in area "${row.area}"` : ""}` };
      }
      if (candidates.length > 1) {
        return { error: `multiple projects match "${row.project}" — add an area and/or product column value to disambiguate` };
      }

      let quadrant = null;
      if (row.quadrant) {
        quadrant = Number(row.quadrant);
        if (!Number.isInteger(quadrant) || quadrant < 1 || quadrant > 4) {
          return { error: `quadrant must be 1-4, got "${row.quadrant}"` };
        }
      }

      const type = row.type ? row.type.toUpperCase() : "OTHER";
      if (!TYPE_OPTIONS.includes(type)) {
        return { error: `type must be one of ${TYPE_OPTIONS.join(", ")}, got "${row.type}"` };
      }

      const status = row.status ? row.status.toUpperCase() : "NOT_STARTED";
      if (!STATUS_KEYS.includes(status)) {
        return { error: `status must be one of ${STATUS_KEYS.join(", ")}, got "${row.status}"` };
      }

      return {
        args: {
          project_id: candidates[0].id,
          description: row.description,
          quadrant,
          type,
          status,
          notes: row.notes || "",
          is_highly_important: isTruthy(row.is_highly_important),
          is_quick_task: isTruthy(row.is_quick_task),
          is_weekly_focus: isTruthy(row.is_weekly_focus),
        },
      };
    },
  },
};

// Resolves every parsed CSV row into either a CREATE_* args object or a
// specific per-row error — used for both a live import and (in tests) for
// exercising the resolution logic without touching the DOM/file APIs at all.
export function buildImportPlan(entityType, records, context) {
  const schema = CSV_SCHEMAS[entityType];
  const items = [];
  const errors = [];
  records.forEach((row, index) => {
    const result = schema.buildArgs(row, context);
    if (result.error) {
      errors.push({ row: index + 2, error: result.error }); // +2: header is row 1, data starts at row 2
    } else {
      items.push(result.args);
    }
  });
  return { items, errors };
}
