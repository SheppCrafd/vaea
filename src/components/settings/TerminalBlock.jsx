import { useState } from "react";
import { Check, Copy } from "lucide-react";

// A real terminal, not a generic <pre> — dark chrome regardless of the
// app's own light/dark theme (real terminals don't follow a web app's
// theme toggle), JetBrains Mono (loaded in index.css, otherwise unused —
// this is the one place actual command output belongs), and the user's
// own Vaea accent color for the prompt, so a page about an entirely
// separate, external system still visibly belongs to their Vaea.
//
// `code`: one command (or "# comment") per line. Comments render dimmed
// with no prompt; blank lines are spacing; everything else gets a `$ `
// prompt (unless `showPrompt` is false, for a real source file being shown
// rather than a sequence of commands to run — see
// LocalModeSetupGuidePage.jsx's watcher script for that case). Copy
// sends the exact text shown, comments included — what you see is what
// lands on the clipboard.
export default function TerminalBlock({ title = "terminal", code, showPrompt = true }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort — clipboard access can be denied by the browser
    }
  };

  const lines = code.split("\n");

  return (
    <div className="rounded-lg overflow-hidden border border-black/40 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#161616]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="font-terminal text-[11px] text-white/40 truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 flex items-center gap-1.5 text-[11px] font-terminal text-white/50 hover:text-white/90 transition-colors"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-primary" /> copied</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> copy</>
          )}
        </button>
      </div>
      <div className="bg-[#0c0c0c] px-4 py-4 overflow-x-auto">
        <pre className="font-terminal text-[13px] leading-relaxed">
          {lines.map((line, i) => {
            const isComment = line.trimStart().startsWith("#");
            const isBlank = line.trim() === "";
            if (isBlank) return <div key={i}>&nbsp;</div>;
            if (isComment) return <div key={i} className="text-white/35">{line}</div>;
            if (!showPrompt) return <div key={i} className="text-white/90 whitespace-pre">{line}</div>;
            return (
              <div key={i} className="text-white/90">
                <span className="text-primary select-none">$ </span>
                {line}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
