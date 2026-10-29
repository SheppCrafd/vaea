// A small MCP client for Granola's server (Streamable HTTP transport,
// JSON-RPC 2.0). It does only what Vaea needs: open a session, list tools,
// and call one. Replies arrive either as plain JSON or as a server-sent event
// stream, and both are handled.
//
// Every call takes the saved connection and returns { result, connection }:
// when the access token has expired it's refreshed first, and the caller
// saves the refreshed connection (same contract as gmailApi/microsoftGraphApi).
import { MCP_URL, refreshGranolaTokens } from "@/lib/granolaOAuth";

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "Vaea", version: "1.0" };

// One MCP session per access token, reused across calls in this tab.
const sessions = new Map();
let nextId = 1;

export class GranolaAuthError extends Error {}

// Pulls the JSON-RPC message with the given id out of an SSE body.
export function parseSse(text, id) {
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue;
    try {
      const msg = JSON.parse(data);
      if (msg.id === id) return msg;
    } catch {
      // not JSON (keep-alive or comment); skip
    }
  }
  return null;
}

async function post(accessToken, sessionId, message) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${accessToken}`,
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  if (sessionId) headers["MCP-Session-Id"] = sessionId;
  const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(message) });
  if (res.status === 401) throw new GranolaAuthError("Granola sign-in expired.");
  return res;
}

async function readReply(res, id) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Granola returned an error (${res.status}). ${text.slice(0, 200)}`.trim());
    err.status = res.status;
    throw err;
  }
  const type = res.headers.get("content-type") || "";
  const msg = type.includes("text/event-stream") ? parseSse(await res.text(), id) : await res.json();
  if (!msg) throw new Error("Granola sent an empty reply. Try again.");
  if (msg.error) throw new Error(msg.error.message || "Granola couldn't complete that request.");
  return msg.result;
}

async function openSession(accessToken) {
  const id = nextId++;
  const res = await post(accessToken, null, {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
  });
  await readReply(res, id);
  const sessionId = res.headers.get("mcp-session-id");
  await post(accessToken, sessionId, { jsonrpc: "2.0", method: "notifications/initialized" });
  sessions.set(accessToken, sessionId);
  return sessionId;
}

async function request(accessToken, method, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sessionId = sessions.has(accessToken) ? sessions.get(accessToken) : await openSession(accessToken);
    const id = nextId++;
    const res = await post(accessToken, sessionId, { jsonrpc: "2.0", id, method, params });
    // 404 means the server dropped the session: open a new one and retry once.
    if (res.status === 404 && attempt === 0) {
      sessions.delete(accessToken);
      continue;
    }
    return readReply(res, id);
  }
  throw new Error("Granola kept closing the connection. Try again.");
}

async function withToken(connection, fn) {
  let current = connection;
  if (!current.accessToken || current.expiresAt < Date.now() + 60 * 1000) {
    current = await refreshGranolaTokens(current);
  }
  try {
    return { result: await fn(current.accessToken), connection: current };
  } catch (err) {
    if (!(err instanceof GranolaAuthError)) throw err;
    sessions.delete(current.accessToken);
    current = await refreshGranolaTokens(current);
    return { result: await fn(current.accessToken), connection: current };
  }
}

export function listTools(connection) {
  return withToken(connection, (token) => request(token, "tools/list", {}));
}

// Returns the tool's result: { content: [{ type: "text", text }], structuredContent?, isError? }.
export async function callTool(connection, name, args = {}) {
  const out = await withToken(connection, (token) => request(token, "tools/call", { name, arguments: args }));
  if (out.result?.isError) {
    const text = (out.result.content || []).map((c) => c.text).filter(Boolean).join(" ");
    throw new Error(text || `Granola couldn't run ${name}.`);
  }
  return out;
}

// The text of a tool result, joined.
export function resultText(result) {
  return (result?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
}
