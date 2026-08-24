import { useRef, useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatToolLogDetail from "@/components/ai/ChatToolLogDetail";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { ROUND_BOUNDARY_MARKER, stripLiveResponsePreview } from "@/lib/llm/streamUtils";

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
// The plan line's own detail is a distinct shape ({reasoning, actions}, both
// optional) from every other line's — ChatToolLogDetail.jsx renders it as
// the model's real natural-language deliberation (every round's own text,
// not just the final one — see useChatController.js) when `reasoning` is
// there, falling back to the structured action breakdown for a message
// persisted before that field existed. Deliberately NOT the message's own
// `reply` (already fully visible in the chat bubble right above this line)
// — showing that again here would just be a pointless echo of something
// already on screen.
export function detailForLogLine(toolLogDetail, i) {
  const liveTrace = toolLogDetail?.liveTrace || [];
  if (i < liveTrace.length) return liveTrace[i]?.detail;
  const j = i - liveTrace.length;
  if (j === 0) return { reasoning: toolLogDetail?.reasoning, actions: toolLogDetail?.plan };
  return toolLogDetail?.steps?.[j - 1];
}

function makeMarkdownComponents(toolLogDetail, onOpenDetail) {
  return {
    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-5 space-y-1 list-disc">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-5 space-y-1 list-decimal">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }) => <h1 className="mt-3 mb-1.5 first:mt-0 text-base font-semibold">{children}</h1>,
    h2: ({ children }) => <h2 className="mt-3 mb-1.5 first:mt-0 text-base font-semibold">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-2.5 mb-1 first:mt-0 text-sm font-semibold">{children}</h3>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="my-2 pl-3 border-l-2 border-border text-muted-foreground">{children}</blockquote>
    ),
    a: ({ children, href }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
        {children}
      </a>
    ),
    hr: () => <hr className="my-2 border-border" />,
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

// Same block-level styling as makeMarkdownComponents' reply text, minus the
// tool-log/code handling — the live streaming preview below never contains a
// ```tool-log block (that's only ever part of a *persisted* message).
const STREAM_MARKDOWN_COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 last:mb-0 pl-5 space-y-1 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 last:mb-0 pl-5 space-y-1 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="mt-3 mb-1.5 first:mt-0 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1.5 first:mt-0 text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2.5 mb-1 first:mt-0 text-sm font-semibold">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-border text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
      {children}
    </a>
  ),
  hr: () => <hr className="my-2 border-border" />,
};

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
// `onFinish` fires exactly once, the real moment this message's own
// animation completes — the caller (ChatAssistantMessage, then
// ChatMessageList's own onMessageTyped prop) uses it to tell
// useChatController.js this id is no longer "new", closing the real bug
// where a remount (e.g. navigating off /app/chat and back — React Router
// really does unmount that route) replayed the whole typewriter again,
// since nothing had ever cleared the id from newMessageIds and this hook's
// own startedRef/finishedRef are fresh on every mount.
function useTypewriter(fullText, enabled, onFinish) {
  const [shownLength, setShownLength] = useState(() => (enabled ? 0 : fullText.length));
  const finishedRef = useRef(false);
  const startedRef = useRef(false); // guards against restarting once `enabled` has already kicked it off
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

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
      onFinishRef.current?.();
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
        onFinishRef.current?.();
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
function ChatAssistantMessage({ m, onOpenDetail, isNew, onFinishTyping }) {
  const components = useMemo(() => makeMarkdownComponents(m.tool_log_detail, onOpenDetail), [m.tool_log_detail, onOpenDetail]);
  const { prefix, reply } = useMemo(() => splitToolLogPrefix(m.content), [m.content]);
  const handleFinishTyping = () => onFinishTyping?.(m.id);
  const { shown, isTyping } = useTypewriter(reply, isNew, handleFinishTyping);
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
export default function ChatMessageList({ messages, isComputing, liveSteps, streamingText, iconChoice, hasMore, onLoadMore, resolvingId, onConfirm, onCancel, newMessageIds, onMessageTyped }) {
  const containerRef = useRef(null);
  const [openDetail, setOpenDetail] = useState(null);
  // Tracks whether the user was already at (or very near) the bottom right
  // before this render's content grew — read at effect-run time below, not
  // during the scroll handler itself, so a fast-scrolling streamed reply's
  // own repeated scrollTop assignments don't fight with the value this
  // decision is based on. Starts true: a brand new mount should follow.
  const wasNearBottomRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 40 && hasMore) onLoadMore();
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Follows the bottom on a new message (user's own or the assistant's
  // reply), when the "thinking" animation appears, and as streamingText
  // keeps growing live — but only if the user was already reading near the
  // bottom. A streamed reply can fire this many times a second; forcing
  // scrollTop on every single delta regardless of where the user actually
  // is reads as the view fighting them the moment they scroll up mid-stream
  // to reread something — the standard chat-UI convention (and the fix) is
  // to only auto-follow while they're already following.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !wasNearBottomRef.current) return;
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
            <ChatAssistantMessage m={m} onOpenDetail={setOpenDetail} isNew={newMessageIds?.has(m.id) ?? false} onFinishTyping={onMessageTyped} />
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
              for Local Mode — see useChatController.js/byokChat.js).
              Rendered through the same real markdown the final persisted
              message uses (not raw text) so headings/bold/bullets already
              look right while it's still growing, instead of showing raw
              "**"/"*" characters that then visibly snap into their real
              rendered form. An unclosed marker for the brief instant before
              its own closing one streams in (e.g. "**Area" before the
              second "**" arrives) is the one accepted trade-off —
              react-markdown just shows it literally until closed, same as
              any other streaming chat UI.

              Split into "past" and "current" round text, "\n\n" (the exact
              ROUND_BOUNDARY_MARKER — a private-use-area sentinel
              useChatController.js's onEvent injects on a real
              "round-boundary" event from the adapter (see
              anthropicAdapter.js's callAnthropic), not "\n\n" — a blank line
              is something the model's own prose can legitimately contain (a
              genuine multi-paragraph answer), so it can't double as "this
              round is over" the way an earlier version of this code assumed.
              Only the LAST round's own text survives once this message is
              actually persisted (see useChatController.js: `reply` is the
              last round's own text, taken whole, however many paragraphs —
              the earlier rounds only live on in the plan's own reasoning
              detail) — so every earlier round is shown already dimmed here,
              live, the moment the NEXT round starts. Without this, a real
              user watched the full multi-round narrative render at full
              contrast, then watched the earlier rounds vanish the instant it
              persisted — a jarring "it loaded, then snapped back." Dimming a
              round the moment it's actually superseded means that
              disappearance is never a surprise — by the time it persists,
              the user already watched every earlier round fade to
              background on its own. A genuine multi-paragraph FINAL round
              (no boundary after it) is never split further — it all stays
              at full contrast together, since it's all one real reply. */}
          {streamingText && (() => {
            const rounds = streamingText.split(ROUND_BOUNDARY_MARKER).filter(Boolean);
            // stripLiveResponsePreview strips the <response>/</response> tag
            // markup itself (see RESPONSE FORMAT in systemPrompt.js) out of
            // this live preview, without hiding the content between them —
            // that content IS the reply, unlike the old <plan> block which
            // never streamed live at all (see planMicroAgents.js: a <plan>
            // block is generated after the fact, never something the model
            // streams).
            const current = stripLiveResponsePreview(rounds.length ? rounds[rounds.length - 1] : streamingText);
            const past = stripLiveResponsePreview(rounds.slice(0, -1).join("\n\n"));
            return (
              <>
                {past && (
                  <div className="text-muted-foreground transition-colors duration-500 mb-2">
                    <ReactMarkdown urlTransform={sanitizeUrl} components={STREAM_MARKDOWN_COMPONENTS}>{past}</ReactMarkdown>
                  </div>
                )}
                <div className="text-foreground">
                  <ReactMarkdown urlTransform={sanitizeUrl} components={STREAM_MARKDOWN_COMPONENTS}>{current}</ReactMarkdown>
                </div>
              </>
            );
          })()}
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
