import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import ChatIcon from "@/components/ai/ChatIcon";

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

// Renders the message list. Scrolling is plain native browser scrolling —
// lazy-loads older messages as the user scrolls near the top.
export default function ChatMessageList({ messages, isComputing, iconChoice, hasMore, onLoadMore, resolvingId, onConfirm, onCancel }) {
  const containerRef = useRef(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 40 && hasMore) onLoadMore();
  };

  // Always scrolls to the bottom on a new message (user's own or the
  // assistant's reply) and also when the "thinking" animation appears, so
  // it's never left out of view above the fold while the assistant works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isComputing]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 text-sm bg-background/50"
    >
      {hasMore && (
        <button onClick={onLoadMore} className="text-[10px] text-muted-foreground hover:text-foreground self-center">
          Load earlier messages
        </button>
      )}

      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
          <div className={`inline-block rounded-lg px-3 py-1.5 max-w-[85%] text-left ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground shadow-sm"}`}>
            <div className="chat-message-content">
              <ReactMarkdown urlTransform={sanitizeUrl}>{m.content}</ReactMarkdown>
            </div>
          </div>
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
        <div className="flex justify-start">
          <div className="inline-block rounded-lg px-3 py-1.5 bg-secondary text-secondary-foreground shadow-sm flex items-center gap-2">
            <ChatIcon iconChoice={iconChoice} className="w-4 h-4 text-primary chat-icon-computing" />
          </div>
        </div>
      )}
    </div>
  );
}