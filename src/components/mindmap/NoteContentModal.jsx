import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Loader2, TriangleAlert, Pencil } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { readVaultNoteContent, writeVaultFile } from "@/lib/githubApi";
import { sanitizeUrl } from "@/lib/sanitizeUrl";

// Clicking a node reads the same real note the graph already knows the
// path of — one more GitHub read, same readVaultNoteContent() call the
// rest of the app's vault features already use, not a second content
// source. Editable in place (raw markdown, not a WYSIWYG editor — same
// "the .md file is the source of truth" discipline every other vault write
// in this app already follows): Edit swaps the rendered view for a plain
// textarea seeded with the real current content, Save writes it straight
// back via writeVaultFile, same primitive VaultGraph.jsx's own create-note/
// draw-link features already use. `onSaved` lets the caller refresh the
// graph afterward, since an edit can add/remove real [[wikilinks]].
export default function NoteContentModal({ path, connection, onClose, onSaved }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError("");
    setEditing(false);
    setSaveError("");
    readVaultNoteContent({ ...connection, path })
      .then((text) => { if (!cancelled) setContent(text); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't read that note."); });
    return () => { cancelled = true; };
  }, [path, connection]);

  const startEditing = () => {
    setDraft(content);
    setSaveError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError("");
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await writeVaultFile({
        ...connection,
        branch: connection.branch || "main",
        path,
        content: draft,
        commitMessage: `Edit ${path} via Vaea Mind Map`,
      });
      setContent(draft);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setSaveError(err.message || "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  };

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
        {content !== null && !error && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-xs px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={`text-xs text-muted-foreground hover:text-foreground transition-colors ${content !== null && !error ? "" : "ml-auto"}`}
          >
            Close
          </button>
        )}
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
        ) : editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="w-full h-full min-h-[50vh] font-terminal text-sm leading-relaxed bg-transparent outline-none resize-none"
              placeholder="Note content — plain markdown, same as the real file."
            />
            {saveError && (
              <p className="flex items-start gap-1.5 text-xs text-destructive mt-2">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {saveError}
              </p>
            )}
          </>
        ) : (
          <div className="text-sm leading-relaxed text-foreground [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_code]:font-terminal [&_code]:text-xs [&_code]:bg-secondary/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
            <ReactMarkdown urlTransform={sanitizeUrl}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </Modal>
  );
}
