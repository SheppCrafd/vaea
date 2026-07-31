import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv.js";
import { buildHierarchyPlan, countActionsByType } from "./csvImport.js";

describe("parseCsv", () => {
  it("parses a simple header + data rows", () => {
    const { headers, records } = parseCsv("title,description\nHome,Personal stuff\nWork,Job stuff");
    expect(headers).toEqual(["title", "description"]);
    expect(records).toEqual([
      { title: "Home", description: "Personal stuff" },
      { title: "Work", description: "Job stuff" },
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    const { records } = parseCsv('title,description\n"Kitchen, remodel",Big project');
    expect(records).toEqual([{ title: "Kitchen, remodel", description: "Big project" }]);
  });

  it("handles a quoted field containing an escaped quote", () => {
    const { records } = parseCsv('title,description\n"Say ""hi""",note');
    expect(records[0].title).toBe('Say "hi"');
  });

  it("handles a quoted field containing a newline", () => {
    const { records } = parseCsv('title,notes\nFoo,"line one\nline two"');
    expect(records[0].notes).toBe("line one\nline two");
  });

  it("tolerates CRLF line endings", () => {
    const { records } = parseCsv("title,description\r\nHome,Stuff\r\nWork,Job");
    expect(records).toHaveLength(2);
    expect(records[1]).toEqual({ title: "Work", description: "Job" });
  });

  it("ignores a trailing blank line", () => {
    const { records } = parseCsv("title\nHome\nWork\n");
    expect(records).toHaveLength(2);
  });

  it("returns empty output for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], records: [] });
  });

  it("fills missing trailing cells as empty strings", () => {
    const { records } = parseCsv("title,description\nHome");
    expect(records[0]).toEqual({ title: "Home", description: "" });
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv, including special characters", () => {
    const headers = ["title", "description"];
    const records = [
      { title: "Kitchen, remodel", description: 'Say "hi"' },
      { title: "Multi\nline", description: "" },
    ];
    const csv = toCsv(headers, records);
    const parsed = parseCsv(csv);
    expect(parsed.records).toEqual(records);
  });

  it("leaves plain fields unquoted", () => {
    const csv = toCsv(["a", "b"], [{ a: "1", b: "2" }]);
    expect(csv).toBe("a,b\r\n1,2");
  });

  it("neutralizes a leading =, +, -, @, tab, or CR to prevent formula/CSV injection", () => {
    const headers = ["title"];
    const leading = ["=SUM(A1)", "+1+1", "-5% budget cut", "@import", "\tHIDDEN", "\rHIDDEN"];
    for (const value of leading) {
      const csv = toCsv(headers, [{ title: value }]);
      const cell = csv.split("\r\n")[1];
      // A quoted-and-escaped cell (tab/CR force quoting) still has the
      // neutralizing "'" right after the opening quote; an unquoted one
      // has it right at the start of the line.
      const bareValue = cell.startsWith('"') ? cell.slice(1) : cell;
      expect(bareValue.startsWith("'")).toBe(true);
    }
  });

  it("does not prefix an ordinary value that merely contains (not starts with) a trigger character", () => {
    const csv = toCsv(["title"], [{ title: "Q3 = growth" }]);
    expect(csv).toBe("title\r\nQ3 = growth");
  });

  it("round-trips a neutralized formula-looking value back through parseCsv unchanged from what was written", () => {
    const csv = toCsv(["title"], [{ title: "=HYPERLINK(\"http://evil.com\")" }]);
    const { records } = parseCsv(csv);
    expect(records[0].title.startsWith("'=")).toBe(true);
  });
});

describe("buildHierarchyPlan", () => {
  const emptyCtx = { areas: [], products: [], projects: [] };

  const row = (overrides) => ({
    area_title: "", area_description: "",
    product_title: "", product_description: "",
    project_title: "", project_description: "",
    task_description: "",
    ...overrides,
  });

  it("a single row with only area columns creates just the area", () => {
    const { actions, errors } = buildHierarchyPlan(
      [row({ area_title: "Home", area_description: "Personal stuff" })],
      emptyCtx
    );
    expect(errors).toEqual([]);
    expect(actions).toEqual([
      { action: "CREATE_AREA", args: { title: "Home", description: "Personal stuff" }, temp_id: "imp_area_0" },
    ]);
  });

  it("builds a full area -> product -> project -> task chain from one row, with temp_id references", () => {
    const { actions, errors } = buildHierarchyPlan(
      [row({ area_title: "Home", product_title: "Renovation", project_title: "Kitchen remodel", task_description: "Book contractor" })],
      emptyCtx
    );
    expect(errors).toEqual([]);
    expect(actions).toHaveLength(4);
    const [area, product, project, task] = actions;
    expect(area).toMatchObject({ action: "CREATE_AREA", temp_id: "imp_area_0" });
    expect(product).toMatchObject({ action: "CREATE_PRODUCT", args: { parent_area_id: "$imp_area_0", title: "Renovation" } });
    expect(project).toMatchObject({ action: "CREATE_PROJECT", args: { parent_area_id: "$imp_area_0", parent_product_id: `$${product.temp_id}`, title: "Kitchen remodel" } });
    expect(task).toEqual({ action: "CREATE_TASK", args: { project_id: `$${project.temp_id}`, description: "Book contractor" } });
  });

  it("reuses the same area across rows instead of creating it twice", () => {
    const { actions } = buildHierarchyPlan(
      [
        row({ area_title: "Home", area_description: "First" }),
        row({ area_title: "home", product_title: "Renovation" }), // case-insensitive reuse
      ],
      emptyCtx
    );
    const areaCreates = actions.filter((a) => a.action === "CREATE_AREA");
    expect(areaCreates).toHaveLength(1);
    const product = actions.find((a) => a.action === "CREATE_PRODUCT");
    expect(product.args.parent_area_id).toBe("$imp_area_0");
  });

  it("a project can attach directly to an area with no product", () => {
    const { actions, errors } = buildHierarchyPlan(
      [row({ area_title: "Home", project_title: "Standalone project" })],
      emptyCtx
    );
    expect(errors).toEqual([]);
    const project = actions.find((a) => a.action === "CREATE_PROJECT");
    expect(project.args.parent_product_id).toBeNull();
  });

  it("reuses an already-existing (live) area/product instead of recreating it", () => {
    const ctx = {
      areas: [{ id: "area1", title: "Home" }],
      products: [{ id: "prod1", title: "Renovation", parent_area_id: "area1" }],
      projects: [],
    };
    const { actions, errors } = buildHierarchyPlan(
      [row({ area_title: "Home", product_title: "Renovation", project_title: "New Project" })],
      ctx
    );
    expect(errors).toEqual([]);
    expect(actions.filter((a) => a.action === "CREATE_AREA")).toHaveLength(0);
    expect(actions.filter((a) => a.action === "CREATE_PRODUCT")).toHaveLength(0);
    const project = actions.find((a) => a.action === "CREATE_PROJECT");
    expect(project.args).toMatchObject({ parent_area_id: "area1", parent_product_id: "prod1" });
  });

  it("errors when a row fills in a column but leaves area_title blank", () => {
    const { actions, errors } = buildHierarchyPlan([row({ product_title: "X" })], emptyCtx);
    expect(actions).toEqual([]);
    expect(errors).toEqual([{ row: 2, error: "area_title is required on any row that fills in another column" }]);
  });

  it("errors when task_description is set but project_title is blank", () => {
    const { actions, errors } = buildHierarchyPlan([row({ area_title: "Home", task_description: "Do it" })], emptyCtx);
    expect(actions.filter((a) => a.action === "CREATE_TASK")).toEqual([]);
    expect(errors).toEqual([{ row: 2, error: "project_title is required when task_description is filled in" }]);
  });

  it("errors when an area title already matches more than one existing area", () => {
    const ctx = { areas: [{ id: "a1", title: "Home" }, { id: "a2", title: "Home" }], products: [], projects: [] };
    const { errors } = buildHierarchyPlan([row({ area_title: "Home" })], ctx);
    expect(errors[0].error).toMatch(/multiple existing areas/);
  });

  it("a fully blank row is skipped silently, not reported as an error", () => {
    const { actions, errors } = buildHierarchyPlan([row({}), row({ area_title: "Home" })], emptyCtx);
    expect(errors).toEqual([]);
    expect(actions).toHaveLength(1);
  });

  it("a failed row does not block a later, independent row from succeeding", () => {
    const { actions, errors } = buildHierarchyPlan(
      [row({ product_title: "orphan, no area" }), row({ area_title: "Home" })],
      emptyCtx
    );
    expect(errors).toHaveLength(1);
    expect(actions).toEqual([{ action: "CREATE_AREA", args: { title: "Home", description: "" }, temp_id: "imp_area_0" }]);
  });

  it("two different projects with the same title under different areas stay distinct", () => {
    const { actions } = buildHierarchyPlan(
      [
        row({ area_title: "Home", project_title: "Setup" }),
        row({ area_title: "Work", project_title: "Setup" }),
      ],
      emptyCtx
    );
    const projectCreates = actions.filter((a) => a.action === "CREATE_PROJECT");
    expect(projectCreates).toHaveLength(2);
    expect(projectCreates[0].args.parent_area_id).not.toBe(projectCreates[1].args.parent_area_id);
  });
});

describe("countActionsByType", () => {
  it("tallies each action type, including zero counts", () => {
    const actions = [
      { action: "CREATE_AREA" }, { action: "CREATE_PRODUCT" },
      { action: "CREATE_PROJECT" }, { action: "CREATE_PROJECT" }, { action: "CREATE_TASK" },
    ];
    expect(countActionsByType(actions)).toEqual({ area: 1, product: 1, project: 2, task: 1 });
  });
});
