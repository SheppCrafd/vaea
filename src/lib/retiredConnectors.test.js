import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ status: "disconnected", fileBacked: false, keys: new Map(), listeners: new Set() }));

vi.mock("@/lib/deviceStorage", () => ({
  getStatus: async () => state.status,
  isFileBackedModeAvailable: async () => state.fileBacked,
  subscribeStatus: (fn) => { state.listeners.add(fn); return () => state.listeners.delete(fn); },
  readKey: async (k) => state.keys.get(k) ?? null,
  removeKey: async (k) => { state.keys.delete(k); },
}));

import { clearRetiredConnectorsWhenReady } from "@/lib/retiredConnectors";

const flush = () => new Promise((r) => setTimeout(r, 0));
const setStatus = async (s) => { state.status = s; state.listeners.forEach((fn) => fn()); await flush(); };

describe("clearRetiredConnectorsWhenReady", () => {
  beforeEach(() => {
    state.status = "disconnected";
    state.fileBacked = false;
    state.listeners.clear();
    state.keys = new Map([["vaea_apple_mail", { emailAddress: "a@icloud.com", appSpecificPassword: "abcd-efgh" }], ["vaea_gmail", { refreshToken: "x" }]]);
  });

  it("removes the saved Apple Mail credential once storage is ready, and nothing else", async () => {
    state.status = "connected";
    await clearRetiredConnectorsWhenReady();
    expect(state.keys.has("vaea_apple_mail")).toBe(false);
    expect(state.keys.has("vaea_gmail")).toBe(true);
  });

  it("waits while storage isn't ready, then runs when it becomes ready", async () => {
    await clearRetiredConnectorsWhenReady();
    expect(state.keys.has("vaea_apple_mail")).toBe(true);
    await setStatus("needs-permission");
    expect(state.keys.has("vaea_apple_mail")).toBe(true);
    await setStatus("cloud-connected");
    expect(state.keys.has("vaea_apple_mail")).toBe(false);
    expect(state.listeners.size).toBe(0);
  });

  it("runs in file-backed mode regardless of status", async () => {
    state.fileBacked = true;
    await clearRetiredConnectorsWhenReady();
    expect(state.keys.has("vaea_apple_mail")).toBe(false);
  });

  it("does nothing when no credential was saved", async () => {
    state.keys.delete("vaea_apple_mail");
    state.status = "manual-ready";
    await clearRetiredConnectorsWhenReady();
    expect([...state.keys.keys()]).toEqual(["vaea_gmail"]);
  });
});
