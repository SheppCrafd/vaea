import { useState } from "react";
import { Paperclip, Link2, X, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sanitizeHttpUrl } from "@/lib/entityUtils";

export default function AttachmentsAndLinks({ project, onSave }) {
  const attachments = project.attachments || [];
  const links = project.links || [];

  const [isUploading, setIsUploading] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onSave({ attachments: [...attachments, { name: file.name, url: file_url }] });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
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
              <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline truncate min-w-0">
                <Paperclip className="w-3 h-3 shrink-0" />
                <span className="truncate">{a.name}</span>
              </a>
              <button onClick={() => removeAttachment(i)} aria-label="Remove attachment" className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:opacity-80">
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
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline truncate min-w-0">
                <Link2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{l.label}</span>
              </a>
              <button onClick={() => removeLink(i)} aria-label="Remove link" className="shrink-0 text-muted-foreground hover:text-destructive">
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
            className="w-24 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
          />
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 text-xs px-2 py-1.5 bg-background border border-input rounded outline-none"
          />
          <button type="submit" disabled={!linkUrl.trim()} className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 shrink-0">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}