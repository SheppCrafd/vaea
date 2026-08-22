import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Loader2, TriangleAlert } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { readVaultNoteContent } from "@/lib/githubApi";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

// Clicking a node reads the same real note the graph already knows the
// path of — one more GitHub read, same readVaultNoteContent() call the
// rest of the app's vault features already use, not a second content
// source. Read-only: editing a note is Obsidian's job (or a real chat
// request), same boundary the graph itself already draws.
export default function NoteContentModal({ path, connection, onClose }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError("");
    readVaultNoteContent({ ...connection, path })
      .then((text) => { if (!cancelled) setContent(text); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't read that note."); });
    return () => { cancelled = true; };
  }, [path, connection]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={path}
      panelClassName="w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border shrink-0">
        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="font-terminal text-xs text-muted-foreground truncate">{path}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </p>
        ) : content === null ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Reading {path}…
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-foreground [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_code]:font-terminal [&_code]:text-xs [&_code]:bg-secondary/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
            <ReactMarkdown urlTransform={sanitizeUrl}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </Modal>
  );
}
