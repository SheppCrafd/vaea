import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Modal from "@/components/shared/Modal";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

// Backs the "click a tool-log line to see what it actually did" feature —
// useChatController.js persists tool_log_detail (every live call's real
// args/result, the plan's own decided actions, and each executed step's
// resolved args + toolResult) alongside the tool-log transcript text;
// ChatMessageList opens one of these per line clicked. Used to render this
// as a raw `JSON.stringify` dump — exactly the "feels like a JSON file"
// complaint this file exists to fix now: humanized action names, humanized
// field labels, nested values rendered as real indented text instead of
// braces/quotes/commas.

export function humanizeAction(action) {
  return String(action)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function humanizeKey(key) {
  return String(key)
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pulls a real, human name out of a step's toolResult (the entity it
// actually created/updated) to show alongside the action — same convention
// describeToolCall (chatActions.js) already renders in the transcript line.
export function resultLabel(toolResult) {
  if (!toolResult || typeof toolResult !== "object") return null;
  const entity = Object.values(toolResult).find((v) => v && typeof v === "object" && (v.title || v.name));
  return entity?.title || entity?.name || null;
}

// Internal plumbing a user never asked about and wouldn't recognize — noise
// in a human-readable view, unlike every other field here.
const HIDDEN_KEYS = new Set(["temp_id"]);

function DataValue({ value }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, i) => (
          <li key={i}>{item && typeof item === "object" ? <DataFields value={item} /> : String(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") return <DataFields value={value} />;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function DataFields({ value }) {
  const entries = Object.entries(value || {}).filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== "");
  if (!entries.length) return null;
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k}>
          <span className="text-muted-foreground">{humanizeKey(k)}: </span>
          <DataValue value={v} />
        </div>
      ))}
    </div>
  );
}

// One action from a plan (not run yet) or one already-executed step — same
// {action, args} shape either way, with `toolResult` only present once it's
// actually run.
function ActionBlock({ step }) {
  const { action, args, toolResult } = step || {};
  const label = resultLabel(toolResult);
  return (
    <div className="border-b border-border last:border-0 pb-3 mb-3 last:pb-0 last:mb-0">
      <p className="font-medium text-foreground mb-1.5">
        {humanizeAction(action)}
        {label ? <span className="text-muted-foreground font-normal"> — {label}</span> : null}
      </p>
      <DataFields value={args} />
    </div>
  );
}

// The plan line's own detail — the model's real deliberation for this turn:
// every round's own text, not just the final one (see useChatController.js
// and, e.g., anthropicAdapter.js's `reasoning` for how this is built),
// rendered as genuine prose: no template, no per-step breakdown, just the
// model's own words for why it's doing what it's doing — "I'll check X
// first... found two matches, so I'll do Y instead... now I'll..." — the
// deliberation, not the destination. Deliberately NOT the message's own
// `reply` — that's already fully visible in the chat bubble immediately
// above this line; showing it again here was a real bug a user caught
// ("the plan is VERBATIM the text in chat"), since a click revealing
// nothing new is worse than no click at all. ChatMessageList.jsx's
// detailForLogLine builds this shape ({reasoning, actions}) specifically
// for the plan line; every other line's own detail (a live tool call's
// result, an executed step's args/toolResult) stays the structured,
// factual view below.
function PlanReasoning({ reasoning, actions }) {
  if (!reasoning) {
    // A message persisted before tool_log_detail carried `reasoning` at
    // all — fall back to the old structured breakdown rather than showing
    // nothing.
    return (
      <div>
        {(actions || []).map((step, i) => (
          <ActionBlock key={i} step={step} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 [&_p]:mb-2 [&_p:last-child]:mb-0">
      <ReactMarkdown urlTransform={sanitizeUrl}>{reasoning}</ReactMarkdown>
    </div>
  );
}

// Real shapes `data` arrives in: the plan line's own {reasoning, actions} (see
// PlanReasoning above), an already-executed step ({action, args,
// toolResult}), or a live tool call's own arbitrary result (search matches,
// a note's content, audit findings) — anything else just renders as plain
// fields.
function DetailBody({ data }) {
  if (data && typeof data === "object" && ("reasoning" in data) && ("actions" in data)) {
    return <PlanReasoning reasoning={data.reasoning} actions={data.actions} />;
  }
  if (Array.isArray(data)) {
    return (
      <div>
        {data.map((step, i) => (
          <ActionBlock key={i} step={step} />
        ))}
      </div>
    );
  }
  if (data && typeof data === "object" && "action" in data) {
    return <ActionBlock step={data} />;
  }
  return <DataFields value={data} />;
}

export default function ChatToolLogDetail({ detail, onClose }) {
  const { title, data } = detail;

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={title}
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[200]"
      panelClassName="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-terminal text-sm font-semibold text-foreground truncate pr-2">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-auto text-[13px] leading-relaxed text-foreground pr-1">
        <DetailBody data={data} />
      </div>
    </Modal>
  );
}
