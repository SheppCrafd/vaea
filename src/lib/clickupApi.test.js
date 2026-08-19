import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listTasks, createTask, updateTask, deleteTask, listChannels, sendMessage, testClickUpConnection } from "./clickupApi.js";

const CONNECTION = { accessToken: "token-1", workspaceId: "ws-1", defaultListId: "list-1" };

describe("clickupApi: tasks", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listTasks reads from the given list and shapes the response", async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [{ id: "t1", name: "Ship it", status: { status: "in progress" }, due_date: null, url: "https://app.clickup.com/t/t1" }] }),
    });
    const tasks = await listTasks(CONNECTION, "list-1");
    expect(tasks).toEqual([{ id: "t1", name: "Ship it", status: "in progress", due_date: null, url: "https://app.clickup.com/t/t1" }]);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/list/list-1/task");
    expect(init.headers.Authorization).toBe("token-1");
  });

  it("createTask POSTs to the given list", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "t2", name: "New task", url: "https://app.clickup.com/t/t2" }) });
    const task = await createTask(CONNECTION, "list-1", { name: "New task" });
    expect(task.id).toBe("t2");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/list/list-1/task");
    expect(init.method).toBe("POST");
  });

  it("updateTask PUTs only the given fields", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "t1", name: "Renamed", url: "u" }) });
    await updateTask(CONNECTION, "t1", { name: "Renamed" });
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/task/t1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ name: "Renamed" });
  });

  it("deleteTask DELETEs", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 204 });
    await deleteTask(CONNECTION, "t1");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/task/t1");
    expect(init.method).toBe("DELETE");
  });

  it("throws a clear error on a rejected token", async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(listTasks(CONNECTION, "list-1")).rejects.toThrow(/reconnecting/);
  });
});

describe("clickupApi: chat", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listChannels reads workspace channels", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: "c1", name: "general", type: "CHANNEL", visibility: "PUBLIC" }] }) });
    const channels = await listChannels(CONNECTION);
    expect(channels).toEqual([{ id: "c1", name: "general", type: "CHANNEL", visibility: "PUBLIC" }]);
    expect(globalThis.fetch.mock.calls[0][0]).toContain("/workspaces/ws-1/chat/channels");
  });

  it("sendMessage POSTs message content as markdown", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "m1", date: 123 }) });
    await sendMessage(CONNECTION, "c1", "Hello team");
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/chat/channels/c1/messages");
    expect(JSON.parse(init.body)).toEqual({ type: "message", content: "Hello team", content_format: "text/md" });
  });
});

describe("clickupApi: testClickUpConnection", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves the workspace id/name from the first team", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ teams: [{ id: "ws-1", name: "My Workspace" }] }) });
    const result = await testClickUpConnection("token-1");
    expect(result).toEqual({ workspaceId: "ws-1", workspaceName: "My Workspace" });
  });

  it("throws when the account has no workspace", async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ teams: [] }) });
    await expect(testClickUpConnection("token-1")).rejects.toThrow(/No ClickUp workspace/);
  });
});
