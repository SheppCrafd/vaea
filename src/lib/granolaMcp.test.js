import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/lib/granolaOAuth", () => ({ MCP_URL: "https://mcp.test/mcp", refreshGranolaTokens: refresh }));

import { parseSse, callTool, resultText } from "@/lib/granolaMcp";

const json = (body, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const sse = (body, headers = {}) =>
  new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, { status: 200, headers: { "content-type": "text/event-stream", ...headers } });

// A fake MCP server: answers initialize with a session id, accepts the
// initialized notification, and hands tools/call to `onCall`.
function server(onCall, { sessionId = "s1" } = {}) {
  const calls = [];
  const fetchMock = vi.fn(async (_url, init) => {
    const msg = JSON.parse(init.body);
    calls.push({ method: msg.method, auth: init.headers.Authorization, session: init.headers["MCP-Session-Id"] });
    if (msg.method === "initialize") return json({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18" } }, { headers: { "mcp-session-id": sessionId } });
    if (msg.method === "notifications/initialized") return new Response(null, { status: 202 });
    return onCall(msg, init, calls);
  });
  return { fetchMock, calls };
}

const fresh = { clientId: "c", accessToken: "a1", refreshToken: "r1", expiresAt: Date.now() + 3600e3 };

describe("parseSse", () => {
  it("finds the reply with the matching id among several events", () => {
    const text = ': keep-alive\n\nevent: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n\n';
    expect(parseSse(text, 7)).toEqual({ jsonrpc: "2.0", id: 7, result: { ok: true } });
    expect(parseSse(text, 8)).toBeNull();
  });
});

describe("callTool", () => {
  let realFetch;
  beforeEach(() => { realFetch = globalThis.fetch; refresh.mockReset(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  it("opens a session, sends the session id, and reads an SSE reply", async () => {
    const { fetchMock, calls } = server((msg) => sse({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "hello" }] } }));
    globalThis.fetch = fetchMock;
    const { result, connection } = await callTool(fresh, "list_meetings", {});
    expect(resultText(result)).toBe("hello");
    expect(connection).toBe(fresh);
    expect(calls.map((c) => c.method)).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    expect(calls[2].session).toBe("s1");
    expect(calls[2].auth).toBe("Bearer a1");
  });

  it("refreshes an expired token before calling", async () => {
    const expired = { ...fresh, accessToken: "old", expiresAt: Date.now() - 1 };
    refresh.mockResolvedValue({ ...expired, accessToken: "new", expiresAt: Date.now() + 3600e3 });
    const { fetchMock, calls } = server((msg) => json({ jsonrpc: "2.0", id: msg.id, result: { content: [] } }), { sessionId: "s2" });
    globalThis.fetch = fetchMock;
    const { connection } = await callTool(expired, "get_meetings", { meeting_ids: ["x"] });
    expect(connection.accessToken).toBe("new");
    expect(calls.every((c) => c.auth === "Bearer new")).toBe(true);
  });

  it("refreshes and retries once when Granola answers 401", async () => {
    const start = { ...fresh, accessToken: "revoked" };
    refresh.mockResolvedValue({ ...start, accessToken: "a2" });
    const { fetchMock } = server((msg, init) =>
      init.headers.Authorization === "Bearer revoked" ? new Response("", { status: 401 }) : json({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "ok" }] } })
    , { sessionId: "s3" });
    globalThis.fetch = fetchMock;
    const { result, connection } = await callTool(start, "list_meetings");
    expect(resultText(result)).toBe("ok");
    expect(connection.accessToken).toBe("a2");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reopens the session once when the server forgets it (404)", async () => {
    let first = true;
    const { fetchMock, calls } = server((msg) => {
      if (first) { first = false; return new Response("", { status: 404 }); }
      return json({ jsonrpc: "2.0", id: msg.id, result: { content: [] } });
    }, { sessionId: "s4" });
    globalThis.fetch = fetchMock;
    await callTool({ ...fresh, accessToken: "a4" }, "list_meetings");
    expect(calls.filter((c) => c.method === "initialize")).toHaveLength(2);
  });

  it("turns a tool error into a thrown Error with Granola's text", async () => {
    const { fetchMock } = server((msg) => json({ jsonrpc: "2.0", id: msg.id, result: { isError: true, content: [{ type: "text", text: "Transcripts need a paid plan." }] } }), { sessionId: "s5" });
    globalThis.fetch = fetchMock;
    await expect(callTool({ ...fresh, accessToken: "a5" }, "get_meeting_transcript")).rejects.toThrow("Transcripts need a paid plan.");
  });
});
