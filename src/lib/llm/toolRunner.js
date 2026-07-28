import { STAGED_TOOL_NAMES, MAX_BULK_ITEMS_PER_CALL } from "@/lib/llm/toolCatalog";
import { runLocalTool } from "@/lib/llm/localTools";
import { DESTRUCTIVE_ACTIONS } from "@/lib/chatActions";

export const MAX_ACTIONS_PER_REQUEST = 60;

// Builds the {label, detail} entry a real (non-staged) tool call's own
// result becomes — same shape aiChatStream/entry.ts's trace() pushes onto
// its own liveTrace, so ChatMessageList renders every provider's live calls
// identically, whichever tool it was.
function describeLiveResult(name, args, result) {
  if (name === "search_workspace") {
    return { label: `search_workspace("${args.query}") — ${result.count} match${result.count === 1 ? "" : "es"}`, detail: { query: args.query, ...result } };
  }
  if (name === "audit_workspace") {
    const total = Object.values(result).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    return { label: `audit_workspace() — ${total} finding${total === 1 ? "" : "s"}`, detail: result };
  }
  if (name === "list_vault_notes") {
    return { label: `list_vault_notes() — ${result.count ?? 0} note${result.count === 1 ? "" : "s"}`, detail: result };
  }
  if (name === "read_vault_note") {
    return { label: `read_vault_note("${args.path}")`, detail: { path: args.path, ...result } };
  }
  if (name === "search_vault") {
    return { label: `search_vault("${args.query}") — ${result.count ?? 0} match${result.count === 1 ? "" : "es"}`, detail: { query: args.query, ...result } };
  }
  if (name === "audit_vault") {
    return { label: `audit_vault() — ${result.broken_links?.length || 0} broken link${result.broken_links?.length === 1 ? "" : "s"}, ${result.isolated_notes?.length || 0} isolated`, detail: result };
  }
  if (name === "read_project_link") {
    return { label: `read_project_link("${args.url}")`, detail: { url: args.url, focus: args.focus, ...result } };
  }
  if (name === "analyze_attachment") {
    // image_base64 is dropped here on purpose — this `detail` feeds the
    // UI's tool-log entry, and dumping a full base64 image into that
    // rendered log (and into React/localStorage-backed message state)
    // would bloat memory for no benefit; the real image data still reaches
    // the model, just via the adapter's own multimodal content block, not
    // through this display copy.
    const { image_base64: _image_base64, ...rest } = result || {};
    return { label: `analyze_attachment("${(args.file_url || "").split("/").pop()}")`, detail: { file_url: args.file_url, focus: args.focus, ...rest } };
  }
  if (name === "web_search") {
    return { label: `web_search("${args.query}")`, detail: { query: args.query, ...result } };
  }
  return null;
}

// One tool runner per request, closed over that request's own accumulating
// `plan` and `liveTrace` arrays — shared by both adapters (anthropicAdapter.js,
// openaiCompatibleAdapter.js) since a tool call's *meaning* (stage vs. run
// for real) doesn't depend on which provider is asking. Mirrors
// aiChatStream/entry.ts's buildTools()' queue()/trace() for both halves.
// Async — several live tools (vault reads/writes, read_project_link,
// analyze_attachment) make real network calls now, not just synchronous
// reads over an already-loaded dataset.
export function makeToolRunner({ plan, liveTrace = [], dataset, externalVault, onEvent }) {
  return async function runTool(name, args) {
    if (STAGED_TOOL_NAMES.has(name)) {
      if (plan.length >= MAX_ACTIONS_PER_REQUEST) {
        return { queued: false, error: `Plan already has ${MAX_ACTIONS_PER_REQUEST} actions queued (the max allowed in one request) — stop adding more and wrap up your reply.` };
      }
      // Checked HERE, at staging time, not just later when the client
      // actually executes the plan (chatActions.js has its own hard copy of
      // this same limit as defense-in-depth) — catching it in this same
      // tool-call round-trip means the model sees the rejection immediately
      // and can retry with a smaller batch itself, before ever telling the
      // user anything, instead of the oversized call sailing through this
      // whole response and only blowing up on the user's own device
      // afterward (or after they've already clicked "Yes, do it").
      if (name === "BULK_CREATE" && Array.isArray(args?.items) && args.items.length > MAX_BULK_ITEMS_PER_CALL) {
        return { queued: false, error: `BULK_CREATE can only create up to ${MAX_BULK_ITEMS_PER_CALL} ${args.entity_type || "records"} per call — split this into multiple BULK_CREATE calls instead.` };
      }
      if (name === "BULK_DELETE" && Array.isArray(args?.ids) && args.ids.length > MAX_BULK_ITEMS_PER_CALL) {
        return { queued: false, error: `BULK_DELETE can only remove up to ${MAX_BULK_ITEMS_PER_CALL} ${args.entity_type || "records"} per call — split this into multiple BULK_DELETE calls instead.` };
      }
      const { temp_id, ...rest } = args || {};
      plan.push({ action: name, args: rest, ...(temp_id ? { temp_id } : {}) });
      // Which note applies depends only on THIS action — not the same as
      // knowing the whole plan's final timing, since a later tool call this
      // same turn could still add a destructive action that makes the
      // WHOLE plan wait on one confirm click (see EXECUTION TIMING in
      // systemPrompt.js). Mirrors aiChatStream/entry.ts's queue() — this
      // tool-result text is more immediate/salient to the model than the
      // system instructions, so a single generic "don't say this happened"
      // hedge here was actively contradicting the non-destructive case.
      const note = DESTRUCTIVE_ACTIONS.has(name)
        ? "Needs the user's own confirm click before this runs — nothing has happened yet. Describe it in future tense (\"This will ...\"), never as already done."
        : "By itself this runs automatically, immediately once this response is returned, with no confirm step — but if this turn's plan also ends up including any destructive action elsewhere, the WHOLE plan waits for that one confirm click instead (see EXECUTION TIMING). Match your final reply's tense to the plan as a whole, not just this one call.";
      return {
        queued: true,
        note,
        ...(temp_id ? { temp_id_registered: temp_id, hint: `Reference this record later as "$${temp_id}" wherever an id is needed for it.` } : {}),
      };
    }
    const result = await runLocalTool(name, args || {}, { dataset, externalVault });
    const entry = describeLiveResult(name, args || {}, result);
    if (entry) {
      liveTrace.push(entry);
      // Emitted live, the instant this tool call actually finishes — mirrors
      // entry.ts's own trace() (the base44-hosted equivalent), so a BYOK
      // provider's live tool calls show up in the chat UI the same real
      // moment they ran, not only once the whole multi-round loop is done.
      onEvent?.({ type: "tool-call", label: entry.label, detail: entry.detail });
    }
    return result;
  };
}
