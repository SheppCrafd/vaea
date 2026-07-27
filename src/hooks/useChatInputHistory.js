import { useEffect, useRef, useState } from "react";

// handleSend (useChatController.js) appends "\n\n[Attached: name](url)" to
// whatever the user actually typed before persisting it — the blob/file url
// is long gone by the time history recalls that message, so putting it back
// verbatim would just look broken. Stripped on the way back into the input.
const ATTACHMENT_SUFFIX = /\n\n\[Attached: .+\]\(.+\)$/;

// Pure decision core, exported for testing the same way useHighlightDim.js
// exports isHighlightMatch — this project's test environment is plain node
// (see vitest.config.js), not jsdom/@testing-library/react, so there's no
// way to actually render a hook; the stateful logic is kept here as a pure
// function instead, and the hook below is just a thin useState/useRef
// wrapper around it.
//
// null return means "not an Up/Down key, or there's nothing to do" — the
// caller leaves the native key behavior alone in that case.
export function computeHistoryStep({ key, index, entries, input, draft }) {
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;

  if (key === "ArrowUp") {
    if (!entries.length) return null;
    if (index === null) return { index: 0, input: entries[0], draft: input };
    if (index >= entries.length - 1) return null; // already at the oldest, no wraparound
    return { index: index + 1, input: entries[index + 1], draft };
  }

  // ArrowDown
  if (index === null) return null; // not browsing — nothing to walk back toward
  if (index === 0) return { index: null, input: draft, draft }; // back past the newest: restore the draft
  return { index: index - 1, input: entries[index - 1], draft };
}

// Up/Down arrow browsing of this session's own past sent messages — the
// same shape as a terminal's shell history. Up walks backward through what
// you've already sent (oldest last, no wraparound), Down walks forward
// again, restoring your own in-progress draft exactly once you pass the
// newest entry. Scoped to whatever's currently loaded in this session's
// message list (chatState.messages) — doesn't trigger its own pagination
// fetch just to grow the history further back.
export function useChatInputHistory({ messages, input, setInput }) {
  const [index, setIndex] = useState(null); // null = not browsing; 0 = most recent
  const draftRef = useRef("");

  const entries = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.replace(ATTACHMENT_SUFFIX, ""))
    .reverse();

  // Typing anything while browsing (rather than continuing to press
  // Up/Down) drops back to "not browsing" — otherwise the next arrow press
  // would jump from wherever the user just edited instead of restarting
  // from the most recent entry, which is confusing to reason about.
  useEffect(() => {
    if (index !== null && input !== entries[index]) setIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const handleKeyDown = (e) => {
    const step = computeHistoryStep({ key: e.key, index, entries, input, draft: draftRef.current });
    if (!step) return;
    e.preventDefault();
    setIndex(step.index);
    setInput(step.input);
    draftRef.current = step.draft;
  };

  return { handleKeyDown };
}
