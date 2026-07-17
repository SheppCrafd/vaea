import { useEffect, useMemo, useState } from "react";
import { CHAT_COMMANDS } from "@/lib/chatCommands";

// Matches only while the whole input is "/" plus letters — the instant a
// space, comma, or any other non-letter character is typed, this stops
// matching and the caller's `isOpen` goes false on its own. Slash commands
// are single words and only recognized at the very start of the message.
const COMMAND_PATTERN = /^\/([a-zA-Z]*)$/;

// Drives the "/" command autocomplete in the chat composer. Unmatched
// commands (e.g. "/notacommand") are never surfaced here — they're simply
// not in CHAT_COMMANDS, so `matches` comes back empty, the menu doesn't
// open, and the text is left alone to be sent as a normal message (the
// backend's own instructions likewise ignore unrecognized slash words).
export function useSlashCommand(input, setInput) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const query = COMMAND_PATTERN.exec(input)?.[1] ?? null;
  const matches = useMemo(
    () => (query === null ? [] : CHAT_COMMANDS.filter((c) => c.name.startsWith(query.toLowerCase()))),
    [query]
  );
  const isOpen = matches.length > 0 && !dismissed;

  useEffect(() => {
    setActiveIndex(0);
    setDismissed(false);
  }, [query]);

  const applyCommand = (name) => {
    setInput(`/${name} `);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      applyCommand(matches[Math.min(activeIndex, matches.length - 1)].name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed(true);
    }
  };

  return { isOpen, matches, activeIndex, setActiveIndex, applyCommand, handleKeyDown };
}
