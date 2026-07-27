// A real end-to-end pipeline test for Backdoor Mode: a simulated local
// model (via the same file-round-loop shape callLocalBridge/
// localBridgeStorage.js use, mocked at the storage boundary the way
// byokChat.test.js already does) makes real tool calls, and this test
// carries the resulting plan all the way through chatActions.js's real
// executeActionSequence into a real localDb — the same pipeline every
// other provider (base44-hosted, Anthropic, OpenAI-compatible) shares.
// Exists because Backdoor Mode's own request/response file mechanics
// (localBridgeStorage.js) can't be exercised in this plain-node test
// environment (no `window`/File System Access API here, and jsdom doesn't
// implement that API either) — this proves everything *above* that layer
// genuinely works for Backdoor Mode specifically, not just assumed from
// shared code, the same way byokChat.test.js's own local-bridge describe
// block does for liveTrace/protocol-reminder.
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./localBridgeStorage.js", () => ({
  getBridgeStatus: vi.fn(async () => "connected"),
  writeRequestFile: vi.fn(async () => {}),
  pollForResponseFile: vi.fn(),
}));

const { pollForResponseFile } = await import("./localBridgeStorage.js");
const { runByokChat } = await import("./byokChat.js");
const { executeActionSequence, describePlan, describeToolCall } = await import("../chatActions.js");
const { localDb } = await import("../localDb.js");

beforeEach(() => {
  globalThis.localStorage.clear();
  vi.clearAllMocks();
  return Promise.all(
    Object.values(localDb).map(async (col) => {
      const items = await col.list();
      await Promise.all(items.map((i) => col.delete?.(i.id) ?? col.update(i.id, { deleted_at: new Date().toISOString() })));
    })
  );
});

describe("Backdoor Mode end-to-end: a real local-model plan actually creates real data", () => {
  it("carries a search_workspace call + a multi-step CREATE plan through to real localDb writes", async () => {
    // Round 0: the "local model" searches first (matching the GROUND YOUR
    // PLAN IN REAL CONTEXT instruction), then stages a full Area -> Project
    // -> Task plan via temp_id chaining, exactly the shape that was
    // reported broken for task creation specifically.
    pollForResponseFile
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "t1", name: "search_workspace", input: { query: "launch" } }],
      })
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "t2", name: "CREATE_AREA", input: { title: "Launch", temp_id: "area1" } },
          { type: "tool_use", id: "t3", name: "CREATE_PROJECT", input: { parent_area_id: "$area1", title: "Beta Launch", temp_id: "proj1" } },
          { type: "tool_use", id: "t4", name: "CREATE_TASK", input: { project_id: "$proj1", description: "Write launch checklist" } },
        ],
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "I'll set up a Launch area with a project and a first task." }],
      });

    const result = await runByokChat({
      providerConfig: { provider: "local-bridge" },
      contextArgs: {
        activeProjectId: null,
        userText: "set up a launch area with a project and a task",
        conversationHistory: "",
        aiIdentity: {},
        areas: [], products: [], projects: [], archivedProjects: [],
        tasks: [], archivedTasks: [], stakeholders: [], departments: [], notes: [],
      },
    });

    // 1. The plan is real and correctly shaped, temp_ids intact for chatActions.js to resolve.
    expect(result.actions).toEqual([
      { action: "CREATE_AREA", args: { title: "Launch" }, temp_id: "area1" },
      { action: "CREATE_PROJECT", args: { parent_area_id: "$area1", title: "Beta Launch" }, temp_id: "proj1" },
      { action: "CREATE_TASK", args: { project_id: "$proj1", description: "Write launch checklist" } },
    ]);

    // 2. The live search call is real and correctly labeled — same shape a
    // staged action gets from describeToolCall, per the "render every live
    // call as a real action" fix.
    expect(result.liveTrace).toHaveLength(1);
    expect(result.liveTrace[0].label).toBe('search_workspace("launch") — 0 matches');

    // 3. Feed the real plan into the real, provider-agnostic executor —
    // this is the exact code path CREATE_TASK's missing-parent-guard bug
    // and the temp_id-resolution bugs were found and fixed in.
    const steps = await executeActionSequence(result.actions);
    const area = steps[0].toolResult.area;
    const project = steps[1].toolResult.project;
    const task = steps[2].toolResult.task;

    expect(project.parent_area_id).toBe(area.id);
    expect(task.project_id).toBe(project.id);

    // 4. Real data, not just a returned value — actually persisted.
    const persistedTasks = await localDb.tasks.filter({ project_id: project.id });
    expect(persistedTasks).toHaveLength(1);
    expect(persistedTasks[0].description).toBe("Write launch checklist");

    // 5. The plan-summary line correctly tallies real entities (the exact
    // bug caught from a screenshot: a bulk step under-counting its own items —
    // not applicable here since these are single CREATE_* calls, but confirms
    // the shared describePlan/describeToolCall rendering works unmodified
    // for a Backdoor-Mode-originated plan same as any other provider's.
    expect(describePlan(result.actions)).toBe("plan · 3 steps across 1 area, 1 project, 1 task");
    expect(describeToolCall(steps[2])).toBe('create_task("Write launch checklist")');
  });
});
