// Folder-based transport for "Local Mode" (src/lib/llm/localBridgeAdapter.js)
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
//                                          answer (the "new" list). Uniformly
//                                          {round, messages} — just the
//                                          conversation delta for this turn.
//                                          The system prompt and tool catalog
//                                          used to be duplicated into round
//                                          0's own file (see
//                                          VAEA_SYSTEM_PROMPT.md/
//                                          VAEA_TOOL_CATALOG.json below for
//                                          where they live now instead), and
//                                          the live workspace dataset +
//                                          current date/time used to be
//                                          inlined as prompt text too (see
//                                          workspace-data.json below).
//   responses/<requestId>-r<round>.json  — written by the user's own local
//                                          watcher script (see
//                                          LocalModeSetupGuidePage.jsx for
//                                          the file contract and a sample
//                                          script)
//   processed/{prompts,responses}/...    — where each pair is filed once the
//                                          response has been read and acted
//                                          on (archiveProcessedRound below) —
//                                          the permanent "known" list, so a
//                                          restarted watcher can never
//                                          re-answer history
//   VAEA_SYSTEM_PROMPT.md, VAEA_TOOL_CATALOG.json
//                                        — the static instructions and full
//                                          tool catalog, written ONCE here
//                                          (writeStaticContextFiles, called
//                                          from writeWatcherKit) rather than
//                                          re-transmitted inside every prompt
//                                          file — a relay reads these once
//                                          and reuses them for every turn.
//   workspace-data.json                 — the LIVE current Areas/Products/
//                                          Projects/Tasks/Stakeholders/
//                                          Departments/Notes snapshot,
//                                          rewritten fresh before every send
//                                          (byokChat.js) since — unlike the
//                                          two files above — this genuinely
//                                          changes turn to turn.
//   bridge_watcher.py, run_watcher.bat/.command, README_LOCAL_MODE.txt,
//   AGENT_RELAY_INSTRUCTIONS.md,
//   .claude/skills/local-relay/SKILL.md
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
//                                          "/local-relay" instead of
//                                          pasting the whole relay
//                                          instructions by hand each turn.

import { BRIDGE_WATCHER_SCRIPT, buildBatLauncher, buildShLauncher, buildReadme, buildAgentRelayInstructions, buildLocalRelaySkill, buildLocalRelaySkillShort, buildLocalRelayCommand } from "./bridgeWatcherKit";
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";
import { buildInstructions } from "@/lib/llm/systemPrompt";
import { toAnthropicTools } from "@/lib/llm/toolCatalog";
import { MAX_ACTIONS_PER_REQUEST } from "@/lib/llm/toolRunner";

export const supportsFileSystemAccess =
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

const HANDLE_DB_NAME = "vaea-local-mode-bridge";
// Pre-rename ("Backdoor Mode") DB name — read as a one-time fallback so an
// already-connected folder's handle isn't lost, never written to again.
const LEGACY_HANDLE_DB_NAME = "vaea-backdoor-bridge";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "directory";

function openHandleDb(dbName = HANDLE_DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getHandleFromDb(dbName) {
  const db = await openHandleDb(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readonly");
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredHandle() {
  try {
    const handle = await getHandleFromDb(HANDLE_DB_NAME);
    if (handle) return handle;
    // Nothing under the new DB name yet — check the pre-rename one and
    // carry the handle forward so a folder connected before this rename
    // doesn't need to be re-picked.
    const legacy = await getHandleFromDb(LEGACY_HANDLE_DB_NAME).catch(() => null);
    if (legacy) await setStoredHandle(legacy);
    return legacy;
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
// The static system prompt + tool catalog — identical on every turn, so
// (as of the prompt-shrink below) they're written ONCE here, when the
// folder is connected/reconfigured, rather than re-transmitted inside every
// prompts/<id>-r<round>.json file. A Claude Code relay (local-relay/l skill)
// already has this folder loaded persistently and can just read these two
// files itself; a scripted watcher (bridge_watcher.py) reads them once at
// startup and caches them in memory (see its own _load_static_context).
// Kept as real files rather than baked into SKILL.md's own text so they
// don't need regenerating every time the tool catalog/instructions change —
// "Update watcher files" (writeWatcherKit, this function) already re-runs on
// every provider-config save.
export async function writeStaticContextFiles() {
  if (!rootHandle) return false;
  try {
    await writeFile(rootHandle, "VAEA_SYSTEM_PROMPT.md", buildInstructions({ maxActionsPerRequest: MAX_ACTIONS_PER_REQUEST }));
    await writeFile(rootHandle, "VAEA_TOOL_CATALOG.json", JSON.stringify(toAnthropicTools(), null, 2));
    return true;
  } catch {
    return false;
  }
}

// The live, per-turn workspace snapshot — unlike the static files above,
// this genuinely changes turn to turn, so it's rewritten fresh right before
// each request (see byokChat.js's local-bridge branch), not written once at
// connect time. Lets prompts/<id>-r<round>.json stay just {round, messages}
// — the actual conversation delta — instead of re-embedding the whole
// dataset as inline JSON text on every single round of a multi-round turn.
export async function writeWorkspaceDataFile(snapshot) {
  if (!rootHandle) return false;
  try {
    await writeFile(rootHandle, "workspace-data.json", JSON.stringify(snapshot, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function writeWatcherKit(config = { connector: "echo" }) {
  if (!rootHandle) return false;
  try {
    await writeFile(rootHandle, "bridge_watcher.py", BRIDGE_WATCHER_SCRIPT);
    await writeFile(rootHandle, "run_watcher.bat", buildBatLauncher(config));
    await writeFile(rootHandle, "run_watcher.command", buildShLauncher(config));
    await writeFile(rootHandle, "README_LOCAL_MODE.txt", buildReadme(config));
    await writeFile(rootHandle, "AGENT_RELAY_INSTRUCTIONS.md", buildAgentRelayInstructions());
    await writeStaticContextFiles();
    // A discoverable Claude Code Skill, for anyone with the Claude Code CLI
    // or VS Code extension already open who'd rather type "/local-relay"
    // than paste AGENT_RELAY_INSTRUCTIONS.md's whole text in by hand.
    const claudeDir = await rootHandle.getDirectoryHandle(".claude", { create: true });
    const skillsDir = await claudeDir.getDirectoryHandle("skills", { create: true });
    const relayDir = await skillsDir.getDirectoryHandle("local-relay", { create: true });
    await writeFile(relayDir, "SKILL.md", buildLocalRelaySkill());
    // Same skill again under a one-letter name ("/l") for anyone answering
    // prompts often enough that "/local-relay" 's keystrokes add up.
    const shortDir = await skillsDir.getDirectoryHandle("l", { create: true });
    await writeFile(shortDir, "SKILL.md", buildLocalRelaySkillShort());
    // Also write the same thing as classic Claude Code Commands
    // (.claude/commands/<name>.md) — the older, more broadly-supported
    // mechanism, for installs/versions where the newer Skills feature isn't
    // discovered. Real customer report: "/l" and "/local-relay" never
    // showed up at all on a locked-down managed device.
    const commandsDir = await claudeDir.getDirectoryHandle("commands", { create: true });
    const commandBody = buildLocalRelayCommand();
    await writeFile(commandsDir, "local-relay.md", commandBody);
    await writeFile(commandsDir, "l.md", commandBody);
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
  if (!stored) throw new Error("No remembered Local Mode folder to reconnect to.");
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
    throw new Error("Local Mode folder isn't connected — go to Settings -> AI Model and connect it first.");
  }
}

function fileNameFor(requestId, round) {
  return `${requestId}-r${round}.json`;
}

// A real customer's Local Mode reply went permanently missing: they
// navigated away (reloaded the page) while a human was still relaying the
// answer through Claude Code, and the requestId that would have claimed the
// eventually-written response only ever lived in one in-memory JS closure —
// gone the moment that navigation happened, even though the answer itself
// sat right there on disk, fully written, forever unread. This is a small,
// durable pointer (deviceStorage, survives a reload the same way any other
// app setting does) recording which chat session/request is still
// outstanding, written the instant a send begins and cleared the instant it
// finishes cleanly. If the app loads and finds a leftover pointer, that's
// the signal an exchange got orphaned and needs resuming — see
// resumeLocalBridgeRequest() in localBridgeAdapter.js, and the on-disk
// reconstruction helpers below it (findLatestLivePromptRound/readPromptFile)
// that make the resume possible without needing to persist anything else:
// the conversation's own system/tools/messages are already sitting in the
// live prompt files, the same recovery bridge_watcher.py's own
// --claude-code mode already relies on.
const PENDING_REQUEST_KEY = "vaea_local_mode_pending_request";
// Pre-rename ("Backdoor Mode") key — read as a one-time fallback so a
// request already in flight when this rename lands isn't stranded.
const LEGACY_PENDING_REQUEST_KEY = "vaea_backdoor_pending_request";

export async function savePendingLocalModeRequest({ sessionId, requestId }) {
  try {
    await writeKey(PENDING_REQUEST_KEY, { sessionId, requestId, savedAt: Date.now() });
  } catch {
    // best-effort — worst case a reload mid-request just can't resume
  }
}

export async function clearPendingLocalModeRequest() {
  try {
    await removeKey(PENDING_REQUEST_KEY);
    await removeKey(LEGACY_PENDING_REQUEST_KEY);
  } catch {
    // best-effort
  }
}

export async function getPendingLocalModeRequest() {
  try {
    return (await readKey(PENDING_REQUEST_KEY)) || (await readKey(LEGACY_PENDING_REQUEST_KEY)) || null;
  } catch {
    return null;
  }
}

// Scans the LIVE prompts/ folder (not processed/) for the highest round
// number still on disk for this requestId — that's the exact round the app
// was mid-poll on when it got interrupted. Returns -1 if none are live
// (either nothing was ever written, or every round already got answered and
// archived — a completed conversation, not actually orphaned).
export async function findLatestLivePromptRound(requestId) {
  requireConnected();
  const prefix = `${requestId}-r`;
  let highest = -1;
  for await (const entry of promptsHandle.values()) {
    if (entry.kind !== "file" || !entry.name.startsWith(prefix) || !entry.name.endsWith(".json")) continue;
    const round = parseInt(entry.name.slice(prefix.length, -".json".length), 10);
    if (Number.isInteger(round) && round > highest) highest = round;
  }
  return highest;
}

// Reads one round's own request payload back off disk — from the live
// prompts/ folder first, falling back to processed/prompts/ (round 0 is
// often already archived by the time a later round is the one still live,
// since only round 0 carries "system"/"tools" and every later round depends
// on it — same fallback bridge_watcher.py's own recovery already uses).
// Returns null if genuinely missing from both.
// Parses JSON that's expected to already be well-formed (this app's own
// prompt files) — still guarded, since a reader can catch a writer
// mid-write (see readResponseFileIfPresent's own comment on the same
// pattern for the relay-written side).
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function readPromptFile(requestId, round) {
  requireConnected();
  const name = fileNameFor(requestId, round);
  try {
    const fh = await promptsHandle.getFileHandle(name, { create: false });
    return safeJsonParse(await (await fh.getFile()).text());
  } catch (err) {
    if (err.name !== "NotFoundError") throw err;
  }
  try {
    const processedRoot = await rootHandle.getDirectoryHandle("processed", { create: false });
    const processedPrompts = await processedRoot.getDirectoryHandle("prompts", { create: false });
    const fh = await processedPrompts.getFileHandle(name, { create: false });
    return safeJsonParse(await (await fh.getFile()).text());
  } catch (err) {
    if (err.name === "NotFoundError") return null;
    throw err;
  }
}

export async function writeRequestFile(requestId, round, data) {
  requireConnected();
  const fh = await promptsHandle.getFileHandle(fileNameFor(requestId, round), { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// A relay-written response file can be read mid-write (a partial file the
// relay's own createWritable()/close() hasn't finished yet) or just plain
// malformed (a human hand-typing JSON, or a model that wrapped it in a
// markdown fence despite being told not to). Either way this used to let a
// raw JSON.parse SyntaxError propagate all the way up through
// pollForResponseFile -> runToolLoop -> callLocalBridge, killing the whole
// turn outright with no chance to ask the relay to resend correctly shaped
// JSON. Returning a typed {malformed: true, raw} instead lets runToolLoop
// (localBridgeAdapter.js) treat this the same as the existing "wrong shape"
// case — one bounded correction round before actually failing.
async function readResponseFileIfPresent(requestId, round) {
  try {
    const fh = await responsesHandle.getFileHandle(fileNameFor(requestId, round), { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { malformed: true, raw: text };
    }
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

// Polls responses/<requestId>-r<round>.json until it appears (written by the
// user's own local watcher script) or `timeoutMs` elapses. Starts fast
// (`fastIntervalMs`, for `fastWindowMs`) then backs off to the steadier
// `intervalMs` — a human answering via a Claude Code skill or a script
// hitting a fast local model typically finishes well inside the fast
// window, so most turns never pay the full 5s-per-check latency; a slow
// answer (a real model actually thinking) still only costs the slower
// interval, not constant polling. A malformed (non-JSON, or valid-JSON-
// wrong-shape) response file is returned to the caller (see
// readResponseFileIfPresent) rather than thrown here — localBridgeAdapter.js
// decides whether to retry or fail.
export async function pollForResponseFile(
  requestId,
  round,
  { intervalMs = 5000, fastIntervalMs = 1000, fastWindowMs = 10000, timeoutMs = 10 * 60 * 1000 } = {}
) {
  requireConnected();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const data = await readResponseFileIfPresent(requestId, round);
    if (data) return data;
    const elapsed = Date.now() - startedAt;
    await sleep(elapsed < fastWindowMs ? fastIntervalMs : intervalMs);
  }
  throw new Error(
    `No response appeared in responses/${fileNameFor(requestId, round)} within ${Math.round(timeoutMs / 1000)}s — is your local watcher script running?`
  );
}
