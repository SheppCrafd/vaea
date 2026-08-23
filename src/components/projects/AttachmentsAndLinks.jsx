import { useState } from "react";
import { Paperclip, Link2, X, Upload } from "lucide-react";
import { sanitizeHttpUrl } from "@/lib/entityUtils";
import { useFileUpload } from "@/hooks/useFileUpload";

export default function AttachmentsAndLinks({ project, onSave }) {
  const attachments = project.attachments || [];
  const links = project.links || [];

  const { isUploading, upload } = useFileUpload();
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const file_url = await upload(file);
    onSave({ attachments: [...attachments, { name: file.name, url: file_url }] });
    e.target.value = "";
  };

  const removeAttachment = (index) => {
    onSave({ attachments: attachments.filter((_, i) => i !== index) });
  };

  const addLink = (e) => {
    e.preventDefault();
    // Invalid/unsafe URLs (e.g. javascript:) are silently rejected here.
    const trimmed = sanitizeHttpUrl(linkUrl);
    if (!trimmed) return;
    onSave({ links: [...links, { label: linkLabel.trim() || trimmed, url: trimmed }] });
    setLinkLabel("");
    setLinkUrl("");
  };

  const removeLink = (index) => {
    onSave({ links: links.filter((_, i) => i !== index) });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Attachments</p>
        <div className="flex flex-col gap-1.5 mb-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs bg-secondary/20 border border-border rounded px-2 py-1.5">
              <a href={sanitizeHttpUrl(a.url) || "#"} target="_blank" rel="noreferrer" title={a.name} className="flex items-center gap-1.5 text-primary hover:underline truncate min-w-0 transition-colors">
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate">{a.name}</span>
              </a>
              <button onClick={() => removeAttachment(i)} aria-label="Remove attachment" className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-md cursor-pointer hover:opacity-80 transition-colors">
          <Upload className="w-3 h-3" />
          {isUploading ? "Uploading..." : "Add file"}
          <input type="file" onChange={handleFileChange} disabled={isUploading} className="hidden" />
        </label>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Links</p>
        <div className="flex flex-col gap-1.5 mb-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs bg-secondary/20 border border-border rounded px-2 py-1.5">
              <a
                href={sanitizeHttpUrl(l.url) || "#"}
                target="_blank"
                rel="noreferrer"
                title={l.label && l.label !== l.url ? `${l.label} — ${l.url}` : l.url}
                className="flex items-center gap-1.5 text-primary hover:underline truncate min-w-0 transition-colors"
              >
                <Link2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{l.label}</span>
              </a>
              <button onClick={() => removeLink(i)} aria-label="Remove link" className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addLink} className="flex items-center gap-1.5">
          <input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Label (optional)"
            aria-label="Link label"
            className="w-24 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            aria-label="Link URL"
            className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="submit" disabled={!linkUrl.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground border border-border rounded-md disabled:opacity-50 shrink-0">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}