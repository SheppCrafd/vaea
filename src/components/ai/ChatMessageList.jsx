import { useRef, useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatToolLogDetail from "@/components/ai/ChatToolLogDetail";

// react-markdown's own default already allows only a safe set of protocols,
// but the AI assistant's reply is composed partly from untrusted database
// content (project titles, task descriptions, custom fields) that an
// attacker could craft to include a `javascript:` or `data:` link. Pin the
// allowed schemes explicitly here so a malicious link injected via prompt
// indirection is stripped to "#" before it ever reaches a clickable anchor.
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#|[^:/?#]*($|[#?]))/i;
const sanitizeUrl = (url) => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (SAFE_URL.test(trimmed)) return url;
  return "";
};

// Fenced ```tool-log blocks are how useChatController.js encodes everything
// real the assistant actually did this turn — every live (already-executed)
// tool call, then the plan tally, then each executed mutation step (see
// describeToolCall in chatActions.js and buildLoggedContent in
// useChatController.js) — rendered the same dim, unbulleted way the
// marketing site's hero mockup shows a tool call, instead of react-markdown's
// default <pre><code> box.
//
// Built per-message (not a module constant) because each message's own
// tool_log_detail (every live call's real args/result, the plan's real
// actions/args, and each step's resolved args + toolResult, persisted by
// useChatController.js) is what makes a given line clickable — the fenced
// block's line order always matches tool_log_detail: liveTrace entries
// first, then the plan line, then one line per executed step.
export function detailForLogLine(toolLogDetail, i) {
  const liveTrace = toolLogDetail?.liveTrace || [];
  if (i < liveTrace.length) return liveTrace[i]?.detail;
  const j = i - liveTrace.length;
  if (j === 0) return toolLogDetail?.plan;
  return toolLogDetail?.steps?.[j - 1];
}

function makeMarkdownComponents(toolLogDetail, onOpenDetail) {
  return {
    pre: ({ children }) => <>{children}</>,
    code({ className, children }) {
      if (className === "language-tool-log") {
        const lines = String(children).replace(/\n$/, "").split("\n");
        return (
          <div className="my-1.5 space-y-0.5 text-muted-foreground">
            {lines.map((line, i) => {
              const data = detailForLogLine(toolLogDetail, i);
              if (!data) return <p key={i}>{line}</p>;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenDetail({ title: line, data })}
                  className="block text-left hover:text-foreground hover:underline decoration-dotted underline-offset-2"
                >
                  {line}
                </button>
              );
            })}
          </div>
        );
      }
      return <code className={`${className || ""} font-terminal text-xs bg-secondary/60 px-1 py-0.5 rounded`}>{children}</code>;
    },
  };
}

// A persisted message's content is `` ```tool-log\n...\n``` `` + the reply
// text, when the turn did anything real (see useChatController.js's
// buildLoggedContent) — the plan/actions lead, the same order they actually
// happened in and the same order their own live reveal (liveSteps,
// .chat-step-reveal) already showed them, with the assistant's own reply
// following as the plain-English wrap-up. That tool-log block already had
// its own live line-by-line reveal before this message ever existed, so
// only the reply portion should type out — replaying the tool-log lines a
// second time here would be redundant. A plain reply with nothing behind it
// has no prefix at all.
const TOOL_LOG_PREFIX_RE = /^```tool-log\n[\s\S]*?\n```\n\n/;
export function splitToolLogPrefix(content) {
  const match = content.match(TOOL_LOG_PREFIX_RE);
  if (!match) return { prefix: "", reply: content };
  return { prefix: match[0], reply: content.slice(match[0].length) };
}

// Reveals `fullText` a character at a time when `enabled`; otherwise (a
// message loaded from chat history, not one that just arrived) it's shown
// in full immediately, with no animation at all. Duration scales with
// length but is capped, so a long reply still finishes typing quickly
// rather than crawling.
//
// Reacts to `enabled` turning true on a LATER render, not just at mount —
// this message's own createMessage.mutateAsync (useChatController.js)
// appends it to the query cache and marks its id "new" via two separate
// state updates that, in practice, land in two separate React commits: the
// cache append renders this component for the first time with `enabled`
// still false (so it mounts already "finished," full text shown), and only
// the *next* render carries `enabled: true`. A `[]`-deps effect that only
// ever looked at mount-time `enabled` would miss that second render
// entirely and never animate at all — confirmed live: instrumented both
// updates and watched them arrive one render apart, every time.
function useTypewriter(fullText, enabled) {
  const [shownLength, setShownLength] = useState(() => (enabled ? 0 : fullText.length));
  const finishedRef = useRef(false);
  const startedRef = useRef(false); // guards against restarting once `enabled` has already kicked it off

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    // Undoes the "mounted already-finished" initial state above, for the
    // case where `enabled` only became true after this component's first
    // render — a no-op when it was already 0.
    setShownLength(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShownLength(fullText.length);
      finishedRef.current = true;
      return;
    }
    let raf;
    const start = performance.now();
    const duration = Math.min(1800, Math.max(300, fullText.length * 10));
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setShownLength(Math.floor(progress * fullText.length));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finishedRef.current = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, fullText]);

  return { shown: fullText.slice(0, shownLength), isTyping: enabled && !finishedRef.current };
}

// One assistant message, split out so its `useMemo` can keep `components`
// referentially stable across re-renders that don't actually change this
// message (e.g. every keystroke in the send box re-rendering the whole
// list). Without this, ChatMessageList.map() called makeMarkdownComponents()
// fresh every render, handing ReactMarkdown a brand-new `code`/`pre`
// component *type* each time — React can't reconcile a changed component
// type in place, so it unmounted and remounted the whole rendered message
// instead, replaying the tool-log lines' fade-in every single keystroke.
function ChatAssistantMessage({ m, onOpenDetail, isNew }) {
  const components = useMemo(() => makeMarkdownComponents(m.tool_log_detail, onOpenDetail), [m.tool_log_detail, onOpenDetail]);
  const { prefix, reply } = useMemo(() => splitToolLogPrefix(m.content), [m.content]);
  const { shown, isTyping } = useTypewriter(reply, isNew);
  return (
    <div className="text-foreground">
      <ReactMarkdown urlTransform={sanitizeUrl} components={components}>{prefix + shown}</ReactMarkdown>
      {isTyping && <span className="inline-block w-[7px] h-[13px] bg-primary/70 align-middle ml-0.5 chat-cursor-blink" />}
    </div>
  );
}

// Renders the message list. Scrolling is plain native browser scrolling —
// lazy-loads older messages as the user scrolls near the top. Styled as a
// flat terminal transcript (user turns prefixed "> ", tool-log lines dim,
// the actual reply full-contrast) rather than chat bubbles — the same
// register as the marketing site's hero mockup, not a decorative match: it's
// the one place real assistant output belongs (see --font-terminal in
// index.css).
export default function ChatMessageList({ messages, isComputing, liveSteps, streamingText, iconChoice, hasMore, onLoadMore, resolvingId, onConfirm, onCancel, newMessageIds }) {
  const containerRef = useRef(null);
  const [openDetail, setOpenDetail] = useState(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 40 && hasMore) onLoadMore();
  };

  // Always scrolls to the bottom on a new message (user's own or the
  // assistant's reply), when the "thinking" animation appears, and as
  // streamingText keeps growing live — otherwise the view stops following
  // once liveSteps itself stops changing, even though the live reply text
  // underneath it keeps growing well after that.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isComputing, streamingText]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4 font-terminal text-[13px] leading-relaxed bg-background/50"
    >
      {hasMore && (
        <button onClick={onLoadMore} className="text-[10px] text-muted-foreground hover:text-foreground self-center">
          Load earlier messages
        </button>
      )}

      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "user" ? (
            <p className="text-foreground whitespace-pre-wrap">
              <span className="text-primary">{'>'}</span> {m.content}
            </p>
          ) : (
            <ChatAssistantMessage m={m} onOpenDetail={setOpenDetail} isNew={newMessageIds?.has(m.id) ?? false} />
          )}
          {m.pending_action && (
            <div className="mt-1.5 flex gap-2 justify-start">
              <button
                onClick={() => onConfirm(m)}
                disabled={resolvingId === m.id}
                className="text-xs px-2.5 py-1 bg-destructive text-destructive-foreground border border-border rounded-md hover:opacity-90 disabled:opacity-50"
              >
                Yes, do it
              </button>
              <button
                onClick={() => onCancel(m)}
                disabled={resolvingId === m.id}
                className="text-xs px-2.5 py-1 bg-secondary text-secondary-foreground border border-border rounded-md hover:opacity-80 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {isComputing && (
        <div className="space-y-0.5">
          <div className="text-muted-foreground space-y-0.5">
            {(liveSteps || []).map((line, i) => (
              <p key={i} className="chat-step-reveal">{line}</p>
            ))}
          </div>
          {/* The model's own narration, growing live as it actually arrives
              (real network deltas for base44-hosted/BYOK, a paced simulation
              for Backdoor Mode — see useChatController.js/byokChat.js).
              Plain text, not markdown — mid-stream text can carry an
              unclosed "**"/"[" that would render oddly; the final persisted
              message renders the complete text through ReactMarkdown once
              this is done. */}
          {streamingText && (
            <p className="text-foreground whitespace-pre-wrap">{streamingText}</p>
          )}
          <p className="flex items-center gap-1.5">
            <ChatIcon iconChoice={iconChoice} className="w-3.5 h-3.5 text-primary chat-icon-computing" />
            <span className="inline-block w-[7px] h-[13px] bg-primary/70 chat-cursor-blink" />
          </p>
        </div>
      )}
      {openDetail && <ChatToolLogDetail detail={openDetail} onClose={() => setOpenDetail(null)} />}
    </div>
  );
}
