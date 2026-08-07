import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory localStorage shim — Vitest's "node" environment has no
// browser storage globals, and localDb.js talks to localStorage directly.
function makeLocalStorage() {
  let store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => (store = new Map()),
  };
}
globalThis.localStorage = makeLocalStorage();

// Minimal `window` shim — SET_APPEARANCE (and SET_CARD_VIEW before it)
// dispatch a real CustomEvent for their client-side bridge components to
// pick up; Node's own EventTarget/CustomEvent globals (stable since Node
// 19+) are enough to register a real listener and assert what got
// dispatched, without needing a full DOM. Needs `.location`/`.history`/
// `.localStorage` too — defining `window` at all flips app-params.js's own
// `isNode` browser-detection (`typeof window === "undefined"`) to false,
// so it then genuinely reads window.location.search et al.
if (typeof globalThis.window === "undefined") {
  const win = new EventTarget();
  win.location = { search: "", pathname: "/", hash: "", href: "http://localhost/" };
  win.history = { replaceState: () => {} };
  win.localStorage = globalThis.localStorage;
  globalThis.window = win;
  if (typeof globalThis.document === "undefined") globalThis.document = { title: "" };
}

const { executeAction, executeActionSequence, stripToolLog, describePlan, DESTRUCTIVE_ACTIONS, NON_EXECUTABLE_ACTIONS, filterReflectionActions } = await import("./chatActions.js");
const { SELF_NOTE_PATH, SELF_NOTE_HARD_CAP_CHARS } = await import("./githubApi.js");
const { localDb } = await import("./localDb.js");
const { writeKey, removeKey } = await import("./deviceStorage.js");
const { VAULT_CONNECTION_KEY } = await import("./vaultConnection.js");

beforeEach(() => {
  globalThis.localStorage.clear();
  // localDb caches collections in-module-scope memory too, not just
  // localStorage — clearing storage alone leaves stale cached arrays behind
  // between tests, since it's the same module instance across the whole
  // file. Re-importing isn't practical here, so drain each collection via
  // its own API instead.
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete?.(i.id) ?? col.update(i.id, { deleted_at: new Date().toISOString() })));
    })
  );
});

describe("chatActions: single actions write to localDb", () => {
  it("CREATE_AREA creates a real area record", async () => {
    const result = await executeAction("CREATE_AREA", { title: "Work", description: "" });
    expect(result.toolResult.area.title).toBe("Work");
    const areas = await localDb.areas.list();
    expect(areas).toHaveLength(1);
    expect(areas[0].title).toBe("Work");
  });

  it("two concurrent SET_AI_IDENTITY calls both merge in, instead of one clobbering the other", async () => {
    // SET_AI_IDENTITY is a real read-modify-write cycle (load current ->
    // merge in args -> save) over a single shared key, the same race shape
    // localDb.js's collections have — without locking it, two calls fired
    // close together (e.g. the "/setup" interview issuing one per turn, or
    // a manual Settings save landing at the same moment) would both read
    // the same starting identity and each write back only their own field,
    // silently losing whichever one wrote first.
    const pName = executeAction("SET_AI_IDENTITY", { name: "Vaea" });
    const pIdentity = executeAction("SET_AI_IDENTITY", { identity: "A helpful assistant" });
    await Promise.all([pName, pIdentity]);

    const { loadAiIdentity } = await import("./aiPreferences.js");
    const final = await loadAiIdentity();
    expect(final.name).toBe("Vaea");
    expect(final.identity).toBe("A helpful assistant");
  });

  it("CREATE_TASK then UPDATE_TASK_STATUS actually changes status", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    const { toolResult } = await executeAction("CREATE_TASK", { project_id: project.id, description: "Do the thing" });
    const taskId = toolResult.task.id;
    await executeAction("UPDATE_TASK_STATUS", { task_id: taskId, status: "IN_PROGRESS" });
    const task = await localDb.tasks.get(taskId);
    expect(task.status).toBe("IN_PROGRESS");
  });
});

describe("chatActions: cascades match the UI's own mutation hooks", () => {
  it("DELETE_AREA soft-deletes the area, its products, projects, and tasks", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { product } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area.id, title: "Product" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, parent_product_id: product.id, title: "Project" });
    const { toolResult: { task } } = await executeAction("CREATE_TASK", { project_id: project.id, description: "Task" });

    await executeAction("DELETE_AREA", { area_id: area.id });

    expect((await localDb.areas.get(area.id)).deleted_at).toBeTruthy();
    expect((await localDb.products.get(product.id)).deleted_at).toBeTruthy();
    expect((await localDb.projects.get(project.id)).deleted_at).toBeTruthy();
    expect((await localDb.tasks.get(task.id)).deleted_at).toBeTruthy();
  });
});

describe("chatActions: multi-step plans with temp_id placeholders", () => {
  it("resolves $temp_id references from earlier steps in the same plan", async () => {
    const steps = await executeActionSequence([
      { action: "CREATE_AREA", args: { title: "Platform", description: "" }, temp_id: "area1" },
      { action: "CREATE_PRODUCT", args: { parent_area_id: "$area1", title: "Core" }, temp_id: "product1" },
      { action: "CREATE_PROJECT", args: { parent_area_id: "$area1", parent_product_id: "$product1", title: "Launch" } },
    ]);

    expect(steps).toHaveLength(3);
    const area = steps[0].toolResult.area;
    const product = steps[1].toolResult.product;
    const project = steps[2].toolResult.project;
    expect(product.parent_area_id).toBe(area.id);
    expect(project.parent_area_id).toBe(area.id);
    expect(project.parent_product_id).toBe(product.id);
  });

  it("throws instead of silently creating an orphan when a temp_id never resolves", async () => {
    // Mirrors a real observed failure: a model's CREATE_PRODUCT step
    // referenced a $temp_id that didn't match any earlier step's temp_id
    // (a typo, or the earlier CREATE_AREA step never got tagged with one).
    // resolvePlaceholders leaves an unresolved "$..." string untouched, so
    // without this guard the product "creates" successfully with a
    // parent_area_id of literally "$area1" — an id that matches no real
    // Area, so it never renders on the Dashboard (no orphan-product
    // fallback exists) even though the chat reports success.
    await expect(
      executeActionSequence([
        { action: "CREATE_AREA", args: { title: "Platform", description: "" } },
        { action: "CREATE_PRODUCT", args: { parent_area_id: "$area1", title: "Core" } },
      ])
    ).rejects.toThrow(/doesn't exist/);
    expect(await localDb.products.list()).toHaveLength(0);
  });

  it("CREATE_PRODUCT/CREATE_PROJECT reject a parent id that doesn't exist", async () => {
    await expect(executeAction("CREATE_PRODUCT", { parent_area_id: "not-a-real-id", title: "Core" })).rejects.toThrow(/doesn't exist/);
    await expect(executeAction("CREATE_PROJECT", { parent_area_id: "not-a-real-id", title: "Launch" })).rejects.toThrow(/doesn't exist/);
  });

  it("a plan that fails partway attaches its already-completed steps to the thrown error, not just a generic message", async () => {
    // Step 1 and 2 really do mutate real data before step 3 fails — the
    // caller (useChatController.js) needs to know that to register undo
    // info for what DID succeed and tell the user how far the plan got,
    // instead of both being silently lost the way they used to be.
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Real area", description: "" });
    let caught;
    try {
      await executeActionSequence([
        { action: "UPDATE_AREA", args: { area_id: area.id, title: "Renamed", description: "" } },
        { action: "CREATE_PRODUCT", args: { parent_area_id: area.id, title: "Real product" } },
        { action: "CREATE_TASK", args: { project_id: "not-a-real-project", description: "This one fails" } },
      ]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toMatch(/2 of 3 steps already completed/);
    expect(caught.completedSteps).toHaveLength(2);
    expect(caught.completedSteps[0].action).toBe("UPDATE_AREA");
    expect(caught.completedSteps[1].action).toBe("CREATE_PRODUCT");
    expect(caught.failedStep.action).toBe("CREATE_TASK");
    // And the real side effects genuinely happened — this isn't just
    // metadata on the error, the area really was renamed and the product
    // really was created.
    expect((await localDb.areas.get(area.id)).title).toBe("Renamed");
    expect(await localDb.products.list()).toHaveLength(1);
  });

  it("does not attach a step-count parenthetical when the very FIRST step fails (nothing completed yet)", async () => {
    await expect(
      executeActionSequence([{ action: "CREATE_TASK", args: { project_id: "not-a-real-project", description: "fails immediately" } }])
    ).rejects.toThrow(/^Project "not-a-real-project" doesn't exist/);
  });

  it("CREATE_TASK/CREATE_NOTE/ARCHIVE_DONE_TASKS reject a project id that doesn't exist", async () => {
    // Same bug class as CREATE_PRODUCT/CREATE_PROJECT above, just found
    // later ("task making is broken too") — CREATE_TASK/CREATE_NOTE had no
    // parent guard at all, so a bad/unresolved project_id silently created
    // a task/note that could never render anywhere (every task/note list
    // view filters strictly by project_id match).
    await expect(executeAction("CREATE_TASK", { project_id: "not-a-real-id", description: "Do the thing" })).rejects.toThrow(/doesn't exist/);
    await expect(executeAction("CREATE_NOTE", { project_id: "not-a-real-id", content: "A note" })).rejects.toThrow(/doesn't exist/);
    await expect(executeAction("ARCHIVE_DONE_TASKS", { project_id: "not-a-real-id" })).rejects.toThrow(/doesn't exist/);
    expect(await localDb.tasks.list()).toHaveLength(0);
    expect(await localDb.projectNotes.list()).toHaveLength(0);
  });

  it("throws instead of silently creating an orphan task when a plan's temp_id never resolves", async () => {
    // Mirrors the earlier CREATE_PRODUCT regression test, for the actual
    // user-reported symptom this time: a chat plan creating a project and a
    // task under it in the same turn, where the task's project_id
    // referenced a $temp_id that was never actually registered.
    await expect(
      executeActionSequence([
        { action: "CREATE_AREA", args: { title: "Platform", description: "" } },
        { action: "CREATE_TASK", args: { project_id: "$project1", description: "Do the thing" } },
      ])
    ).rejects.toThrow(/doesn't exist/);
    expect(await localDb.tasks.list()).toHaveLength(0);
  });

  it("BULK_CREATE items can reference a $temp_id registered by an earlier single CREATE_* step", async () => {
    // Confirms the exact alternative the updated system-prompt guidance
    // recommends: a batch that shares ONE new parent should tag that parent
    // with its own individual CREATE_* + temp_id first, then a single
    // BULK_CREATE's items can all reference it — resolvePlaceholders walks
    // the whole step's args (including nested arrays) before execution, so
    // this isn't special-cased to single CREATE_* calls the way the
    // "temp_id only works for a single CREATE_* call" line might suggest;
    // that line is about a BULK_CREATE step's OWN items never being
    // individually re-referenceable afterward, not about BULK_CREATE being
    // unable to consume a temp_id someone else already registered.
    const steps = await executeActionSequence([
      { action: "CREATE_AREA", args: { title: "Platform", description: "" }, temp_id: "area1" },
      {
        action: "BULK_CREATE",
        args: {
          entity_type: "product",
          items: [
            { parent_area_id: "$area1", title: "Core" },
            { parent_area_id: "$area1", title: "Edge" },
          ],
        },
      },
    ]);

    const area = steps[0].toolResult.area;
    expect(steps[1].toolResult.count).toBe(2);
    const products = await localDb.products.filter({ parent_area_id: area.id });
    expect(products.map((p) => p.title).sort()).toEqual(["Core", "Edge"]);
  });

  it("BULK_CREATE creates multiple records of the same type", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });

    const result = await executeAction("BULK_CREATE", {
      entity_type: "task",
      items: [
        { project_id: project.id, description: "Task 1" },
        { project_id: project.id, description: "Task 2" },
      ],
    });

    expect(result.toolResult.count).toBe(2);
    const tasks = await localDb.tasks.filter({ project_id: project.id });
    expect(tasks).toHaveLength(2);
  });

  it("BULK_CREATE rejects more than 5 items in one call", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });

    await expect(
      executeAction("BULK_CREATE", {
        entity_type: "task",
        items: Array.from({ length: 6 }, (_, i) => ({ project_id: project.id, description: `Task ${i}` })),
      })
    ).rejects.toThrow(/up to 5/);
  });

  it("BULK_DELETE rejects more than 5 ids in one call", async () => {
    await expect(
      executeAction("BULK_DELETE", { entity_type: "task", ids: ["a", "b", "c", "d", "e", "f"] })
    ).rejects.toThrow(/up to 5/);
  });
});

describe("chatActions: array-field id validation (stakeholder_ids/related_product_ids)", () => {
  // Unlike a single parent reference (parent_area_id, project_id — always
  // guarded by assertParentExists), an unresolved $temp_id or stale id
  // INSIDE an array field used to land verbatim in a real record with no
  // validation at all — a silent dangling reference, not a thrown error.
  it("CREATE_TASK rejects a stakeholder id that doesn't exist", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    await expect(
      executeAction("CREATE_TASK", { project_id: project.id, description: "Task", stakeholder_ids: ["ghost-stakeholder"] })
    ).rejects.toThrow(/Stakeholder "ghost-stakeholder" doesn't exist/);
    expect(await localDb.tasks.list()).toHaveLength(0);
  });

  it("CREATE_PROJECT rejects an unresolved related_product_id placeholder", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    await expect(
      executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project", related_product_ids: ["$never_created"] })
    ).rejects.toThrow(/Related product "\$never_created" doesn't exist/);
    expect(await localDb.projects.list()).toHaveLength(0);
  });

  it("CREATE_PROJECT accepts a real stakeholder id", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { stakeholder } } = await executeAction("CREATE_STAKEHOLDER", { name: "Real Person" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project", stakeholder_ids: [stakeholder.id] });
    expect(project.stakeholder_ids).toEqual([stakeholder.id]);
  });
});

describe("chatActions: UPDATE_PROJECT now validates parent/array fields it accepts (it used to skip validation entirely, unlike MOVE_PROJECT)", () => {
  it("rejects a stale parent_area_id passed directly to UPDATE_PROJECT", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    await expect(
      executeAction("UPDATE_PROJECT", { project_id: project.id, parent_area_id: "not-a-real-area" })
    ).rejects.toThrow(/Area "not-a-real-area" doesn't exist/);
  });

  it("rejects a stale stakeholder_ids entry passed to UPDATE_PROJECT", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    await expect(
      executeAction("UPDATE_PROJECT", { project_id: project.id, stakeholder_ids: ["ghost"] })
    ).rejects.toThrow(/Stakeholder "ghost" doesn't exist/);
  });

  it("a plain title/objective update with no parent or array fields still works with no extra lookups", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { project } } = await executeAction("CREATE_PROJECT", { parent_area_id: area.id, title: "Project" });
    const { toolResult } = await executeAction("UPDATE_PROJECT", { project_id: project.id, title: "Renamed" });
    expect(toolResult.project.title).toBe("Renamed");
  });
});

describe("chatActions: MOVE_PRODUCT — chat parity for dragging a Product onto a different Area (the UI could always do this; chat had no equivalent tool at all until now)", () => {
  it("moves a product to a new area", async () => {
    const { toolResult: { area: area1 } } = await executeAction("CREATE_AREA", { title: "Area 1", description: "" });
    const { toolResult: { area: area2 } } = await executeAction("CREATE_AREA", { title: "Area 2", description: "" });
    const { toolResult: { product } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area1.id, title: "Product" });

    const { toolResult } = await executeAction("MOVE_PRODUCT", { product_id: product.id, parent_area_id: area2.id });
    expect(toolResult.product.parent_area_id).toBe(area2.id);
  });

  it("rejects a stale/deleted destination area", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult: { product } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area.id, title: "Product" });
    await expect(executeAction("MOVE_PRODUCT", { product_id: product.id, parent_area_id: "not-a-real-area" })).rejects.toThrow(/doesn't exist/);
  });
});

describe("chatActions: DELETE_CUSTOM_FIELD — chat parity for the UI's 'remove field' button (SET_CUSTOM_FIELD only ever covered add/update)", () => {
  it("removes a previously-set custom field, leaving other fields intact", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    await executeAction("SET_CUSTOM_FIELD", { entity_type: "area", entity_id: area.id, label: "Priority", value: "High", show_on_card: true });
    await executeAction("SET_CUSTOM_FIELD", { entity_type: "area", entity_id: area.id, label: "Owner", value: "Alex" });

    const { toolResult } = await executeAction("DELETE_CUSTOM_FIELD", { entity_type: "area", entity_id: area.id, label: "Priority" });

    expect(toolResult.entity.custom_data.priority).toBeUndefined();
    expect(toolResult.entity.custom_data.owner).toEqual({ label: "Owner", value: "Alex" });
    // Also scrubbed from the show-on-card list, not just the value map.
    expect(toolResult.entity.display_on_card_fields).not.toContain("priority");
  });

  it("is a harmless no-op removing a field that was never set", async () => {
    const { toolResult: { area } } = await executeAction("CREATE_AREA", { title: "Area", description: "" });
    const { toolResult } = await executeAction("DELETE_CUSTOM_FIELD", { entity_type: "area", entity_id: area.id, label: "Never Set" });
    expect(toolResult.entity.id).toBe(area.id);
  });
});

describe("chatActions: REORDER_ENTITY — chat parity for drag-to-reorder (Areas/Products/Projects had no chat equivalent at all until now)", () => {
  it("reorders areas (one global sibling list)", async () => {
    const { toolResult: { area: a } } = await executeAction("CREATE_AREA", { title: "A", description: "" });
    const { toolResult: { area: b } } = await executeAction("CREATE_AREA", { title: "B", description: "" });
    const { toolResult: { area: c } } = await executeAction("CREATE_AREA", { title: "C", description: "" });

    // "Move C above A" -> C should land at position 0, before A.
    await executeAction("REORDER_ENTITY", { entity_type: "area", entity_id: c.id, before_id: a.id });

    const areas = await localDb.areas.list();
    const byId = Object.fromEntries(areas.map((x) => [x.id, x]));
    expect(byId[c.id].position).toBeLessThan(byId[a.id].position);
    expect(byId[a.id].position).toBeLessThan(byId[b.id].position);
  });

  it("reorders products only among siblings sharing the same parent area — a product in a different area is untouched", async () => {
    const { toolResult: { area: area1 } } = await executeAction("CREATE_AREA", { title: "Area 1", description: "" });
    const { toolResult: { area: area2 } } = await executeAction("CREATE_AREA", { title: "Area 2", description: "" });
    const { toolResult: { product: p1 } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area1.id, title: "P1" });
    const { toolResult: { product: p2 } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area1.id, title: "P2" });
    const { toolResult: { product: other } } = await executeAction("CREATE_PRODUCT", { parent_area_id: area2.id, title: "Other area's product" });
    const otherBefore = await localDb.products.get(other.id);

    await executeAction("REORDER_ENTITY", { entity_type: "product", entity_id: p2.id, before_id: p1.id });

    const p1After = await localDb.products.get(p1.id);
    const p2After = await localDb.products.get(p2.id);
    const otherAfter = await localDb.products.get(other.id);
    expect(p2After.position).toBeLessThan(p1After.position);
    expect(otherAfter.position).toBe(otherBefore.position); // untouched — different area entirely
  });

  it("moves an entity to the end of its list when before_id is omitted", async () => {
    const { toolResult: { area: a } } = await executeAction("CREATE_AREA", { title: "A", description: "" });
    const { toolResult: { area: b } } = await executeAction("CREATE_AREA", { title: "B", description: "" });
    await executeAction("REORDER_ENTITY", { entity_type: "area", entity_id: a.id });
    const areas = await localDb.areas.list();
    const byId = Object.fromEntries(areas.map((x) => [x.id, x]));
    expect(byId[b.id].position).toBeLessThan(byId[a.id].position);
  });

  it("rejects reordering a deleted/nonexistent entity", async () => {
    await expect(executeAction("REORDER_ENTITY", { entity_type: "area", entity_id: "not-real" })).rejects.toThrow(/doesn't exist/);
  });
});

describe("chatActions: SET_APPEARANCE — chat parity for Settings -> Appearance (SET_CARD_VIEW already established this 'safe UI preference' pattern)", () => {
  it("dispatches a real event with the requested theme and accent", async () => {
    const { APPEARANCE_CHANGE_EVENT } = await import("./appearanceConstants.js");
    let received;
    const handler = (e) => { received = e.detail; };
    window.addEventListener(APPEARANCE_CHANGE_EVENT, handler);
    try {
      const { toolResult } = await executeAction("SET_APPEARANCE", { theme: "dark", accent: "emerald" });
      expect(received).toEqual({ mode: "dark", accent: "emerald" });
      expect(toolResult).toEqual({ theme: "dark", accent: "emerald" });
    } finally {
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, handler);
    }
  });

  it("allows setting just one of theme/accent", async () => {
    const { APPEARANCE_CHANGE_EVENT } = await import("./appearanceConstants.js");
    let received;
    const handler = (e) => { received = e.detail; };
    window.addEventListener(APPEARANCE_CHANGE_EVENT, handler);
    try {
      await executeAction("SET_APPEARANCE", { accent: "indigo" });
      expect(received).toEqual({ mode: undefined, accent: "indigo" });
    } finally {
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, handler);
    }
  });

  it("rejects an invalid theme/accent value", async () => {
    await expect(executeAction("SET_APPEARANCE", { theme: "neon" })).rejects.toThrow(/theme must be one of/);
    await expect(executeAction("SET_APPEARANCE", { accent: "chartreuse" })).rejects.toThrow(/accent must be one of/);
  });

  it("rejects a call with neither field set", async () => {
    await expect(executeAction("SET_APPEARANCE", {})).rejects.toThrow(/at least one of/);
  });
});

describe("chatActions: destructive-action classification", () => {
  it("flags deletes and bulk operations as destructive", () => {
    expect(DESTRUCTIVE_ACTIONS.has("DELETE_PROJECT")).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("BULK_DELETE")).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has("ARCHIVE_DONE_TASKS")).toBe(true);
  });

  it("does not flag ordinary creates/updates as destructive", () => {
    expect(DESTRUCTIVE_ACTIONS.has("CREATE_TASK")).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has("UPDATE_PROJECT")).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has("ARCHIVE_PROJECT")).toBe(false);
  });

  it("does not flag WRITE_VAULT_NOTE as destructive — git provides its own undo", () => {
    expect(DESTRUCTIVE_ACTIONS.has("WRITE_VAULT_NOTE")).toBe(false);
  });
});

describe("chatActions: WRITE_VAULT_NOTE", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("throws without ever calling fetch when no vault is connected", async () => {
    await expect(executeAction("WRITE_VAULT_NOTE", { path: "Daily/2026-07-22.md", content: "x" })).rejects.toThrow(/no vaea vault connected/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("writes to the connected repo using the stored token", async () => {
    await writeKey(VAULT_CONNECTION_KEY, { owner: "me", repo: "vault", branch: "main", token: "t" });
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: { sha: "abc" }, commit: { html_url: "https://github.com/me/vault/commit/abc" } }) });

    const { toolResult } = await executeAction("WRITE_VAULT_NOTE", { path: "Daily/2026-07-22.md", content: "# Today\nDid stuff." });

    expect(toolResult.vaultNote.path).toBe("Daily/2026-07-22.md");
    expect(toolResult.vaultNote.commitUrl).toBe("https://github.com/me/vault/commit/abc");
    await removeKey(VAULT_CONNECTION_KEY);
  });
});

describe("chatActions: describePlan tallies real entity counts, not step counts", () => {
  it("counts every item inside a BULK_CREATE, not just the one step", () => {
    // Real bug, caught by a user clicking the "plan · ..." line and
    // comparing it against the toolLogDetail JSON underneath: a plan of
    // one BULK_CREATE(2 areas) + one BULK_CREATE(5 products) rendered as
    // "plan · 2 steps across 1 area, 1 product" — the counts were literally
    // "how many BULK_CREATE steps of this type", not "how many entities."
    const actions = [
      { action: "BULK_CREATE", args: { entity_type: "area", items: [{ title: "A" }, { title: "B" }] } },
      { action: "BULK_CREATE", args: { entity_type: "product", items: [{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }, { title: "5" }] } },
    ];
    expect(describePlan(actions)).toBe("plan · 2 steps across 2 areas, 5 products");
  });

  it("counts every id inside a BULK_DELETE the same way", () => {
    const actions = [{ action: "BULK_DELETE", args: { entity_type: "task", ids: ["t1", "t2", "t3"] } }];
    expect(describePlan(actions)).toBe("plan · 1 step across 3 tasks");
  });

  it("still counts ordinary single-entity actions as 1 each", () => {
    const actions = [
      { action: "CREATE_AREA", args: { title: "A" } },
      { action: "CREATE_PRODUCT", args: { title: "P", parent_area_id: "a1" } },
    ];
    expect(describePlan(actions)).toBe("plan · 2 steps across 1 area, 1 product");
  });

  it("mixes a bulk step and a single step correctly in the same plan", () => {
    const actions = [
      { action: "CREATE_AREA", args: { title: "A" }, temp_id: "area1" },
      { action: "BULK_CREATE", args: { entity_type: "product", items: [{ title: "1" }, { title: "2" }] } },
    ];
    expect(describePlan(actions)).toBe("plan · 2 steps across 1 area, 2 products");
  });
});

describe("chatActions: stripToolLog", () => {
  it("removes the leading fenced tool-log block, keeping the plain-English reply after it", () => {
    const content = '```tool-log\nplan · 4 steps across 1 area, 1 product, 1 project, 1 task\nbulk_create(5 area)\nbulk_create(10 product)\n```\n\nAll set. Let me know what\'s next.';
    expect(stripToolLog(content)).toBe("All set. Let me know what's next.");
  });

  it("leaves a message with no tool-log block untouched", () => {
    expect(stripToolLog("Just a plain reply, no plan ran.")).toBe("Just a plain reply, no plan ran.");
  });
});

describe("chatActions: filterReflectionActions — the hard half of the 'a reflection turn cannot mutate the workspace' guarantee", () => {
  it("drops UNDO_LAST_ACTION outright — a reflection turn must never call runUndo(), regardless of actionHistory state", () => {
    const actions = [{ action: "UNDO_LAST_ACTION", args: {} }];
    expect(filterReflectionActions(actions)).toEqual({ autoExecute: [], pending: [] });
  });

  const todayLogPath = `Daily/${new Date().toISOString().slice(0, 10)}.md`;

  it("forces every staged action to pending EXCEPT the two allowlisted vault paths — the caller is responsible for never auto-executing anything else", () => {
    // Every staged action a real plan could ever contain, both destructive
    // (DESTRUCTIVE_ACTIONS members, which route to pending_action in a
    // normal turn too) and non-destructive (which auto-EXECUTE with no
    // confirmation in a normal turn — SET_AI_IDENTITY, WRITE_VAULT_NOTE,
    // CREATE_*, etc.). None of them get the reflection-turn auto-execute
    // exception; only a WRITE_VAULT_NOTE to exactly one of the two
    // allowlisted paths does (covered in the tests below).
    const destructive = [...DESTRUCTIVE_ACTIONS].map((action) => ({ action, args: {} }));
    const nonDestructiveStaged = [
      "SET_AI_IDENTITY", "CREATE_AREA", "CREATE_TASK",
      "UPDATE_TASK", "SET_CARD_VIEW", "EXPORT_CSV",
    ].map((action) => ({ action, args: {} }));
    // A WRITE_VAULT_NOTE to some OTHER, non-allowlisted path — must still be pending.
    const otherVaultWrite = { action: "WRITE_VAULT_NOTE", args: { path: "Decisions/Something.md", content: "x" } };
    const all = [...destructive, ...nonDestructiveStaged, otherVaultWrite];

    const { autoExecute, pending } = filterReflectionActions(all);
    expect(autoExecute).toEqual([]);
    expect(pending).toHaveLength(all.length);
    expect(pending.map((a) => a.action).sort()).toEqual(all.map((a) => a.action).sort());
  });

  it("auto-executes WRITE_VAULT_NOTE to the self-notes file", () => {
    const action = { action: "WRITE_VAULT_NOTE", args: { path: SELF_NOTE_PATH, content: "notes about myself" } };
    const { autoExecute, pending } = filterReflectionActions([action]);
    expect(autoExecute).toEqual([action]);
    expect(pending).toEqual([]);
  });

  it("demotes an oversized self-note write to pending instead of auto-executing — a runaway generation gets a human's eyes on it", () => {
    const action = { action: "WRITE_VAULT_NOTE", args: { path: SELF_NOTE_PATH, content: "x".repeat(SELF_NOTE_HARD_CAP_CHARS + 1) } };
    const { autoExecute, pending } = filterReflectionActions([action]);
    expect(autoExecute).toEqual([]);
    expect(pending).toEqual([action]);
  });

  it("still auto-executes a self-note write right at the hard cap, only past it", () => {
    const atCap = { action: "WRITE_VAULT_NOTE", args: { path: SELF_NOTE_PATH, content: "x".repeat(SELF_NOTE_HARD_CAP_CHARS) } };
    expect(filterReflectionActions([atCap]).autoExecute).toEqual([atCap]);
  });

  it("auto-executes WRITE_VAULT_NOTE to today's Daily/ log, matching /vault-log's own convention", () => {
    const action = { action: "WRITE_VAULT_NOTE", args: { path: todayLogPath, content: "what happened" } };
    const { autoExecute, pending } = filterReflectionActions([action]);
    expect(autoExecute).toEqual([action]);
    expect(pending).toEqual([]);
  });

  it("does NOT auto-execute WRITE_VAULT_NOTE to yesterday's or any other date's Daily/ file — only today's exact path", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const action = { action: "WRITE_VAULT_NOTE", args: { path: `Daily/${yesterday}.md`, content: "x" } };
    const { autoExecute, pending } = filterReflectionActions([action]);
    expect(autoExecute).toEqual([]);
    expect(pending).toEqual([action]);
  });

  it("drops UNDO_LAST_ACTION even when mixed in with other actions, keeping the rest split correctly", () => {
    const actions = [
      { action: "CREATE_TASK", args: { description: "x" } },
      { action: "UNDO_LAST_ACTION", args: {} },
      { action: "WRITE_VAULT_NOTE", args: { path: SELF_NOTE_PATH, content: "x" } },
    ];
    const { autoExecute, pending } = filterReflectionActions(actions);
    expect(autoExecute.map((a) => a.action)).toEqual(["WRITE_VAULT_NOTE"]);
    expect(pending.map((a) => a.action)).toEqual(["CREATE_TASK"]);
  });

  it("handles an empty or missing actions array", () => {
    expect(filterReflectionActions([])).toEqual({ autoExecute: [], pending: [] });
    expect(filterReflectionActions(undefined)).toEqual({ autoExecute: [], pending: [] });
  });

  it("NON_EXECUTABLE_ACTIONS is exactly what's dropped entirely — a sanity cross-check against the real export, not a hardcoded duplicate", () => {
    const actions = [...NON_EXECUTABLE_ACTIONS].map((action) => ({ action, args: {} }));
    expect(filterReflectionActions(actions)).toEqual({ autoExecute: [], pending: [] });
  });
});
