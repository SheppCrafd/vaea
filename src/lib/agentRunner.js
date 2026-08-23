// Foreground, on-demand execution for named agents (agentsStore.js) —
// deliberately NOT a background worker: there's no server cron or service
// worker anywhere in this app (same honesty constraint reflectionTrigger.js
// already documents), so a "cadence" here only ever means "checked the next
// time the app happens to be open," same as the reflection check-in cycle.
// The actual turn itself (create a session, invoke the assistant, apply the
// reply through the normal action pipeline) lives in useChatController.js's
// runAgentTurn, since that needs real hook state this module doesn't have —
// this module only holds the pure pieces: the instruction text and the
// due-check.

// Pure — the message sent in place of real user input for an agent run.
// Deliberately plain and short: unlike a reflection turn (which hands the
// model code-computed workspace facts to ground itself in), an agent run is
// closer to a normal user turn — the agent's own `purpose` IS the ask.
export function buildAgentInstruction(agent) {
  return `[AGENT RUN — "${agent.name}", started ${agent.cadenceHours ? "automatically on its own schedule" : "on request"}, not by a live user message this turn]
Purpose: ${agent.purpose || "(no purpose set — use your best judgment based on the name alone.)"}

Act on this now: look at whatever real workspace/vault/connected-service data is relevant, and either do the useful thing directly or propose it, exactly as you would for a normal request with this same purpose. Write ONE reply as the first message of a brand-new conversation, explaining what you found or did.`;
}

// Pure — which agents are due for an automatic run right now. An agent with
// no cadenceHours (the default) is manual-run-only and never appears here.
// `lastRunAt` null (never run) always counts as due, same "never set ==
// due" convention reflectionPreferences.js's own fields use.
export function getDueAgents(agents, now = Date.now()) {
  return (agents || []).filter((a) => {
    if (!a.cadenceHours) return false;
    if (!a.lastRunAt) return true;
    return now - new Date(a.lastRunAt).getTime() >= a.cadenceHours * 60 * 60 * 1000;
  });
}
