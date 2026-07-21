import { Paperclip, X, Upload } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { useFileUpload } from "@/hooks/useFileUpload";
import PositionedPopover from "@/components/shared/PositionedPopover";
import { sanitizeHttpUrl } from "@/lib/entityUtils";

// Compact attachments popover for a task row — a paperclip icon showing the
// attachment count, opening a small upload/list/remove panel. Mirrors
// StakeholderAssigner's trigger+portal pattern but for files instead of people.
export default function TaskAttachments({ attachments = [], onSave }) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });
  const { isUploading, upload } = useFileUpload();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const file_url = await upload(file);
    onSave([...attachments, { name: file.name, url: file_url }]);
    e.target.value = "";
  };

  const removeAttachment = (index) => {
    onSave(attachments.filter((_, i) => i !== index));
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Task attachments"
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="w-3.5 h-3.5" />
        {attachments.length > 0 && attachments.length}
      </button>

      <PositionedPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        panelClassName="fixed w-56 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100"
      >
        <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 py-1 border-b border-border mb-1">Attachments</p>
        {attachments.length === 0 && <p className="text-xs text-muted-foreground px-1 py-1">No attachments yet.</p>}
        <div className="flex flex-col gap-1 mb-1">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-1 text-xs px-1 py-1 hover:bg-secondary rounded-sm">
              <a href={sanitizeHttpUrl(a.url) || "#"} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline min-w-0">
                {a.name}
              </a>
              <button onClick={() => removeAttachment(i)} aria-label="Remove attachment" className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <label className="flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 bg-secondary text-secondary-foreground border border-border rounded cursor-pointer hover:opacity-80">
          <Upload className="w-3 h-3" />
          {isUploading ? "Uploading..." : "Add file"}
          <input type="file" onChange={handleFileChange} disabled={isUploading} className="hidden" />
        </label>
      </PositionedPopover>
    </>
  );
}