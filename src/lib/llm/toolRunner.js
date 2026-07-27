import { STAGED_TOOL_NAMES, MAX_BULK_ITEMS_PER_CALL } from "@/lib/llm/toolCatalog";
import { runLocalTool } from "@/lib/llm/localTools";
import { DESTRUCTIVE_ACTIONS } from "@/lib/chatActions";

export const MAX_ACTIONS_PER_REQUEST = 60;

// One tool runner per request, closed over that request's own accumulating
// `plan` array — shared by both adapters (anthropicAdapter.js,
// openaiCompatibleAdapter.js) since a tool call's *meaning* (stage vs. run
// for real) doesn't depend on which provider is asking. Mirrors
// aiChatStream/entry.ts's buildTools()' queue() for the staged half.
export function makeToolRunner({ plan, dataset }) {
  return function runTool(name, args) {
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
    return runLocalTool(name, args || {}, dataset);
  };
}
