import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv.js";
import { buildImportPlan } from "./csvImportSchemas.js";

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
});

describe("buildImportPlan", () => {
  const areas = [{ id: "area1", title: "Home" }, { id: "area2", title: "Work" }];
  const products = [{ id: "prod1", title: "Renovation", parent_area_id: "area1" }];
  const projects = [
    { id: "proj1", title: "Kitchen remodel", parent_area_id: "area1", parent_product_id: "prod1" },
    { id: "proj2", title: "Duplicate Name", parent_area_id: "area1", parent_product_id: null },
    { id: "proj3", title: "Duplicate Name", parent_area_id: "area2", parent_product_id: null },
  ];
  const ctx = { areas, products, projects };

  it("area: builds args from a valid row", () => {
    const { items, errors } = buildImportPlan("area", [{ title: "New Area", description: "desc" }], ctx);
    expect(errors).toEqual([]);
    expect(items).toEqual([{ title: "New Area", description: "desc" }]);
  });

  it("area: reports a missing required field with its row number", () => {
    const { items, errors } = buildImportPlan("area", [{ title: "", description: "x" }], ctx);
    expect(items).toEqual([]);
    expect(errors).toEqual([{ row: 2, error: "title is required" }]);
  });

  it("product: resolves an area title to its id", () => {
    const { items, errors } = buildImportPlan("product", [{ title: "New Product", area: "Home", description: "" }], ctx);
    expect(errors).toEqual([]);
    expect(items[0].parent_area_id).toBe("area1");
  });

  it("product: fails when the referenced area doesn't exist", () => {
    const { items, errors } = buildImportPlan("product", [{ title: "X", area: "Nonexistent", description: "" }], ctx);
    expect(items).toEqual([]);
    expect(errors[0].error).toMatch(/no area found/);
  });

  it("project: resolves both area and product titles", () => {
    const { items, errors } = buildImportPlan(
      "project",
      [{ title: "New Project", area: "Home", product: "Renovation", due_date_status: "committed" }],
      ctx
    );
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({ parent_area_id: "area1", parent_product_id: "prod1", due_date_status: "COMMITTED" });
  });

  it("project: rejects an invalid due_date_status", () => {
    const { errors } = buildImportPlan("project", [{ title: "X", area: "Home", due_date_status: "SOMEDAY" }], ctx);
    expect(errors[0].error).toMatch(/due_date_status must be/);
  });

  it("task: resolves an unambiguous project title directly", () => {
    const { items, errors } = buildImportPlan("task", [{ description: "Do it", project: "Kitchen remodel" }], ctx);
    expect(errors).toEqual([]);
    expect(items[0].project_id).toBe("proj1");
  });

  it("task: fails on an ambiguous project title with no disambiguating column", () => {
    const { items, errors } = buildImportPlan("task", [{ description: "Do it", project: "Duplicate Name" }], ctx);
    expect(items).toEqual([]);
    expect(errors[0].error).toMatch(/multiple projects match/);
  });

  it("task: an area column disambiguates a duplicate project title", () => {
    const { items, errors } = buildImportPlan(
      "task",
      [{ description: "Do it", project: "Duplicate Name", area: "Work" }],
      ctx
    );
    expect(errors).toEqual([]);
    expect(items[0].project_id).toBe("proj3");
  });

  it("task: defaults quadrant/type/status and parses boolean-ish flags", () => {
    const { items, errors } = buildImportPlan(
      "task",
      [{ description: "Do it", project: "Kitchen remodel", is_highly_important: "yes", is_quick_task: "no" }],
      ctx
    );
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({
      quadrant: null, type: "OTHER", status: "NOT_STARTED",
      is_highly_important: true, is_quick_task: false, is_weekly_focus: false,
    });
  });

  it("task: rejects an out-of-range quadrant", () => {
    const { errors } = buildImportPlan("task", [{ description: "x", project: "Kitchen remodel", quadrant: "9" }], ctx);
    expect(errors[0].error).toMatch(/quadrant must be 1-4/);
  });

  it("processes multiple rows independently, collecting errors per-row without stopping", () => {
    const { items, errors } = buildImportPlan(
      "area",
      [{ title: "Good" }, { title: "" }, { title: "AlsoGood" }],
      ctx
    );
    expect(items).toHaveLength(2);
    expect(errors).toEqual([{ row: 3, error: "title is required" }]);
  });
});
