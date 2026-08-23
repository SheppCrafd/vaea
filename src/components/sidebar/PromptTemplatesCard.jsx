import { useEffect, useState } from "react";
import { FileText, Plus, X, Pencil } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { loadPromptTemplates, savePromptTemplates } from "@/lib/promptTemplatesStore";

// The chat sidebar's Prompt Templates card — save a reusable prompt, click
// it to drop the text straight into the composer, or edit it in place.
// Real and fully working: no variable-fill UI yet (that's a later
// refinement), so a template with a placeholder like {{project}} just
// inserts literally, ready to edit by hand before sending.
export default function PromptTemplatesCard({ onUse }) {
  const [templates, setTemplates] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    loadPromptTemplates().then(setTemplates);
  }, []);

  const resetForm = () => {
    setName("");
    setText("");
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (template) => {
    setEditingId(template.id);
    setName(template.name);
    setText(template.text);
    setAdding(false);
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    const next = editingId
      ? templates.map((t) => (t.id === editingId ? { ...t, name: name.trim(), text: text.trim() } : t))
      : [...templates, { id: crypto.randomUUID(), name: name.trim(), text: text.trim() }];
    setTemplates(next);
    await savePromptTemplates(next);
    resetForm();
  };

  const removeTemplate = async (id) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    await savePromptTemplates(next);
    if (editingId === id) resetForm();
  };

  return (
    <Accordion type="multiple" className="w-full px-2">
      <AccordionItem value="templates">
        <AccordionTrigger className="text-sm px-1">Prompt Templates</AccordionTrigger>
        <AccordionContent className="px-1 pb-2">
          {templates.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No templates saved yet.</p>
          )}

          {templates.map((template) =>
            editingId === template.id ? (
              <form key={template.id} onSubmit={saveTemplate} className="flex flex-col gap-1.5 px-2 py-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name"
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
                />
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What should this drop into the composer?"
                  rows={3}
                  className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <div className="flex gap-1.5">
                  <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Save</button>
                  <button type="button" onClick={resetForm} className="text-xs px-2.5 py-1 text-muted-foreground">Cancel</button>
                </div>
              </form>
            ) : (
              <div key={template.id} className="flex items-start gap-2 text-xs px-2 py-2 rounded-lg hover:bg-secondary/40 group">
                <button
                  onClick={() => onUse?.(template.text)}
                  className="flex items-start gap-2 min-w-0 flex-1 text-left"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{template.name}</span>
                    <span className="block text-muted-foreground truncate">{template.text}</span>
                  </span>
                </button>
                <button
                  onClick={() => startEdit(template)}
                  aria-label={`Edit ${template.name}`}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeTemplate(template.id)}
                  aria-label={`Delete ${template.name}`}
                  className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}

          {adding ? (
            <form onSubmit={saveTemplate} className="flex flex-col gap-1.5 px-2 py-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What should this drop into the composer?"
                rows={3}
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
              <div className="flex gap-1.5">
                <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Save</button>
                <button type="button" onClick={resetForm} className="text-xs px-2.5 py-1 text-muted-foreground">Cancel</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="w-full flex items-center gap-1.5 text-xs px-2 py-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary/40"
            >
              <Plus className="w-3.5 h-3.5" /> New template
            </button>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
