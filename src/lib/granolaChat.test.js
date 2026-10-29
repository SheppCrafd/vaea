import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => ({ value: null, saved: [] }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/granolaConnection", () => ({
  loadGranolaConnection: async () => store.value,
  saveGranolaConnection: async (c) => { store.saved.push(c); },
  isGranolaConnected: (c) => !!(c?.clientId && c?.accessToken),
}));
vi.mock("@/lib/granolaOAuth", () => ({ refreshGranolaTokens: refresh }));

import { granolaForChat } from "@/lib/granolaChat";

const base = { clientId: "c", accessToken: "a1", refreshToken: "r1", emailAddress: "bob@example.com", plan: "free" };

describe("granolaForChat", () => {
  beforeEach(() => { store.saved = []; refresh.mockReset(); });

  it("sends only the access token, email and plan, never the refresh token", async () => {
    store.value = { ...base, expiresAt: Date.now() + 3600e3 };
    const out = await granolaForChat();
    expect(out).toEqual({ accessToken: "a1", emailAddress: "bob@example.com", plan: "free" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a token with under 10 minutes left and saves the rotated tokens", async () => {
    store.value = { ...base, expiresAt: Date.now() + 60e3 };
    refresh.mockResolvedValue({ ...base, accessToken: "a2", refreshToken: "r2", expiresAt: Date.now() + 3600e3 });
    const out = await granolaForChat();
    expect(out.accessToken).toBe("a2");
    expect(store.saved[0].refreshToken).toBe("r2");
  });

  it("returns nothing when Granola isn't connected or the refresh fails", async () => {
    store.value = { clientId: "", accessToken: "" };
    expect(await granolaForChat()).toEqual({});
    store.value = { ...base, expiresAt: 0 };
    refresh.mockRejectedValue(new Error("invalid_grant"));
    expect(await granolaForChat()).toEqual({});
  });
});
