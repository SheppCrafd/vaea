// Folder-based transport for "Backdoor Mode" (src/lib/llm/localBridgeAdapter.js)
// — an enterprise's own on-prem/local model answers Vaea Chat by watching a
// folder on disk instead of this browser calling an HTTP API. Same File
// System Access primitive as deviceStorage.js (a folder the user grants
// access to once, the handle persisted in IndexedDB so a return visit only
// needs a one-click permission re-grant), but a completely separate handle
// and folder — this is a request/response transport, not app data, so it
// deliberately doesn't share deviceStorage.js's store or its dirHandle.
//
// Layout inside the chosen folder, created automatically on first connect:
//   prompts/<requestId>-r<round>.json    — written by this browser; only ever
//                                          holds rounds still waiting for an
//                                          answer (the "new" list). Only
//                                          round 0 carries `system`/`tools`
//                                          (identical, and large, on every
//                                          round of one turn — see
//                                          localBridgeAdapter.js's own
//                                          comment); bridge_watcher.py
//                                          reconstructs the full request
//                                          before a watcher script ever
//                                          sees it.
//   responses/<requestId>-r<round>.json  — written by the user's own local
//                                          watcher script (see
//                                          BackdoorModeSetupGuidePage.jsx for
//                                          the file contract and a sample
//                                          script)
//   processed/{prompts,responses}/...    — where each pair is filed once the
//                                          response has been read and acted
//                                          on (archiveProcessedRound below) —
//                                          the permanent "known" list, so a
//                                          restarted watcher can never
//                                          re-answer history
//   bridge_watcher.py, run_watcher.bat/.command, README_BACKDOOR_MODE.txt,
//   AGENT_RELAY_INSTRUCTIONS.md,
//   .claude/skills/backdoor-relay/SKILL.md
//                                        — written automatically on connect
//                                          (writeWatcherKit) so "choose a
//                                          folder" already leaves a runnable
//                                          watcher behind, not just an empty
//                                          prompts/responses pair the user
//                                          has to populate by hand.
//                                          AGENT_RELAY_INSTRUCTIONS.md is
//                                          the manual-relay path — plain
//                                          instructions for handing ONE
//                                          pending prompt to any coding
//                                          agent with real file tools
//                                          (Copilot Chat, Cursor, Claude
//                                          Code, etc.), for anyone who'd
//                                          rather not run a persistent
//                                          watcher process at all.
//                                          SKILL.md is the same idea
//                                          packaged as a real Claude Code
//                                          Skill, invocable as
//                                          "/backdoor-relay" instead of
//                                          pasting the whole relay
//                                          instructions by hand each turn.

import { BRIDGE_WATCHER_SCRIPT, buildBatLauncher, buildShLauncher, buildReadme, buildAgentRelayInstructions, buildBackdoorSkill } from "./bridgeWatcherKit";

export const supportsFileSystemAccess =
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

const HANDLE_DB_NAME = "vaea-backdoor-bridge";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "directory";

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredHandle() {
  try {
    const db = await openHandleDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setStoredHandle(handle) {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort — worst case the user re-picks the folder next visit
  }
}

async function clearStoredHandle() {
  try {
    const db = await openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort
  }
}

// Must be called from a user-gesture handler (click) — the permission
// prompt this can trigger is spec'd to require one.
async function ensurePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

let rootHandle = null; // set once connected/reconnected this session
let promptsHandle = null;
let responsesHandle = null;
const statusListeners = new Set();

function notify() {
  statusListeners.forEach((fn) => fn());
}

export function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

// 'connected'         — folder is live and writable this session
// 'needs-permission'  — a remembered folder exists but needs a re-grant click
// 'disconnected'      — no folder ever chosen, or not supported in this browser
export async function getBridgeStatus() {
  if (!supportsFileSystemAccess) return "disconnected";
  if (rootHandle) return "connected";
  const stored = await getStoredHandle();
  return stored ? "needs-permission" : "disconnected";
}

export async function getRememberedFolderName() {
  const stored = await getStoredHandle();
  return stored?.name ?? null;
}

async function openSubfolders(handle) {
  promptsHandle = await handle.getDirectoryHandle("prompts", { create: true });
  responsesHandle = await handle.getDirectoryHandle("responses", { create: true });
}

async function writeFile(dirHandle, name, contents) {
  const fh = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(contents);
  await writable.close();
}

// Drops a ready-to-run watcher straight into the connected folder — the
// script itself, a double-click launcher for Windows and Mac, and a README
// explaining both. Best-effort: a write failure here (e.g. a read-only
// mount) shouldn't block the folder from connecting, since the transport
// itself only needs prompts/ and responses/ to exist, not these files.
export async function writeWatcherKit(config = { connector: "echo" }) {
  if (!rootHandle) return false;
  try {
    await writeFile(rootHandle, "bridge_watcher.py", BRIDGE_WATCHER_SCRIPT);
    await writeFile(rootHandle, "run_watcher.bat", buildBatLauncher(config));
    await writeFile(rootHandle, "run_watcher.command", buildShLauncher(config));
    await writeFile(rootHandle, "README_BACKDOOR_MODE.txt", buildReadme(config));
    await writeFile(rootHandle, "AGENT_RELAY_INSTRUCTIONS.md", buildAgentRelayInstructions());
    // A discoverable Claude Code Skill, for anyone with the Claude Code CLI
    // or VS Code extension already open who'd rather type "/backdoor-relay"
    // than paste AGENT_RELAY_INSTRUCTIONS.md's whole text in by hand.
    const claudeDir = await rootHandle.getDirectoryHandle(".claude", { create: true });
    const skillsDir = await claudeDir.getDirectoryHandle("skills", { create: true });
    const relayDir = await skillsDir.getDirectoryHandle("backdoor-relay", { create: true });
    await writeFile(relayDir, "SKILL.md", buildBackdoorSkill());
    return true;
  } catch {
    return false;
  }
}

// Must be called from a click handler — showDirectoryPicker requires a user
// gesture.
export async function connectBridgeFolder() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await openSubfolders(handle);
  rootHandle = handle;
  await setStoredHandle(handle);
  await writeWatcherKit();
  notify();
  return handle;
}

// Must be called from a click handler — the underlying requestPermission
// call requires a user gesture.
export async function reconnectBridgeFolder() {
  const stored = await getStoredHandle();
  if (!stored) throw new Error("No remembered Backdoor Mode folder to reconnect to.");
  const granted = await ensurePermission(stored);
  if (!granted) throw new Error("Permission to the folder was not granted.");
  await openSubfolders(stored);
  rootHandle = stored;
  notify();
  return stored;
}

export async function disconnectBridgeFolder() {
  rootHandle = null;
  promptsHandle = null;
  responsesHandle = null;
  await clearStoredHandle();
  notify();
}

function requireConnected() {
  if (!promptsHandle || !responsesHandle) {
    throw new Error("Backdoor Mode folder isn't connected — go to Settings -> AI Model and connect it first.");
  }
}

function fileNameFor(requestId, round) {
  return `${requestId}-r${round}.json`;
}

export async function writeRequestFile(requestId, round, data) {
  requireConnected();
  const fh = await promptsHandle.getFileHandle(fileNameFor(requestId, round), { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readResponseFileIfPresent(requestId, round) {
  try {
    const fh = await responsesHandle.getFileHandle(fileNameFor(requestId, round), { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err.name === "NotFoundError") return null;
    throw err;
  }
}

// The File System Access API has no cross-directory move — copy then delete.
async function moveFile(sourceDir, targetDir, name) {
  const fh = await sourceDir.getFileHandle(name, { create: false });
  const text = await (await fh.getFile()).text();
  const target = await targetDir.getFileHandle(name, { create: true });
  const writable = await target.createWritable();
  await writable.write(text);
  await writable.close();
  await sourceDir.removeEntry(name);
}

// Once a round's response has been read and acted on, the prompt has done
// its job — the pair is filed out of the live folders into processed/
// (new list -> known list). prompts/ stays an honest "still waiting" view
// for the Settings readout and any watcher, and a watcher restarted after
// downtime can never re-answer history. Best-effort by design: a failed
// move leaves stale files behind but never breaks the chat turn that
// already consumed the round.
export async function archiveProcessedRound(requestId, round) {
  if (!rootHandle || !promptsHandle || !responsesHandle) return;
  const name = fileNameFor(requestId, round);
  try {
    const processedRoot = await rootHandle.getDirectoryHandle("processed", { create: true });
    const processedPrompts = await processedRoot.getDirectoryHandle("prompts", { create: true });
    const processedResponses = await processedRoot.getDirectoryHandle("responses", { create: true });
    await moveFile(promptsHandle, processedPrompts, name).catch(() => {});
    await moveFile(responsesHandle, processedResponses, name).catch(() => {});
  } catch {
    // best-effort
  }
}

// The prebuilt folder inspection — one implementation for anything that
// needs to look inside the bridge folder (the Settings readout today):
// which prompts are still waiting (new) and how many rounds have been
// processed (known). Returns null when the folder isn't connected.
export async function inspectBridgeFolder() {
  if (!rootHandle || !promptsHandle) return null;
  const pending = [];
  for await (const entry of promptsHandle.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".json")) pending.push(entry.name);
  }
  let processed = 0;
  try {
    const processedRoot = await rootHandle.getDirectoryHandle("processed", { create: false });
    const processedPrompts = await processedRoot.getDirectoryHandle("prompts", { create: false });
    for await (const entry of processedPrompts.values()) {
      if (entry.kind === "file" && entry.name.endsWith(".json")) processed += 1;
    }
  } catch (err) {
    if (err.name !== "NotFoundError") throw err;
  }
  return { pending: pending.sort(), processed };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls responses/<requestId>-r<round>.json every `intervalMs` until it
// appears (written by the user's own local watcher script) or `timeoutMs`
// elapses. A malformed (non-JSON) response file surfaces immediately as a
// thrown error rather than being silently treated as "not there yet".
export async function pollForResponseFile(requestId, round, { intervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = {}) {
  requireConnected();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await readResponseFileIfPresent(requestId, round);
    if (data) return data;
    await sleep(intervalMs);
  }
  throw new Error(
    `No response appeared in responses/${fileNameFor(requestId, round)} within ${Math.round(timeoutMs / 1000)}s — is your local watcher script running?`
  );
}
