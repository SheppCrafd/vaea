import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { parseCsv, toCsv } from "@/lib/csv";
import { CSV_SCHEMAS, buildImportPlan } from "@/lib/csvImportSchemas";
import { executeAction } from "@/lib/chatActions";

const ENTITY_OPTIONS = [
  { key: "task", label: "Tasks" },
  { key: "project", label: "Projects" },
  { key: "product", label: "Products" },
  { key: "area", label: "Areas" },
];

function downloadTemplate(entityType) {
  const schema = CSV_SCHEMAS[entityType];
  const csv = toCsv(schema.columns, [schema.example]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio-tracker-${entityType}-template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Bulk-create tab of the Create New popover: download a template for one
// entity type, fill it in outside the app, then import the same file back.
// Runs every row through the exact same BULK_CREATE action the AI chat
// assistant uses (src/lib/chatActions.js) — one creation/cascade
// implementation, not a second copy for CSV specifically.
export default function CsvImportForm() {
  const [entityType, setEntityType] = useState("task");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null); // { created, errors }
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();

  const schema = CSV_SCHEMAS[entityType];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a failed import
    if (!file) return;

    setIsImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const { records } = parseCsv(text);
      const { items, errors } = buildImportPlan(entityType, records, { areas, products, projects });
      if (items.length) {
        await executeAction("BULK_CREATE", { entity_type: entityType, items });
        ["areas", "products", "projects", "tasks"].forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        );
      }
      setResult({ created: items.length, errors });
    } catch (error) {
      setResult({ created: 0, errors: [{ row: "-", error: error.message || "Couldn't read that file." }] });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium block mb-1">What are you importing?</label>
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setResult(null); }}
          className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md"
        >
          {ENTITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        Download the template below, add a row per {schema.label.toLowerCase()}, then import that same file.
        {schema.columns.includes("area") && " Reference an existing area/product/project by its exact title — not an internal id."}
      </p>

      <Button type="button" variant="outline" className="w-full" onClick={() => downloadTemplate(entityType)}>
        Download {schema.label} Template
      </Button>

      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      <Button type="button" className="w-full" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
        {isImporting ? "Importing..." : "Import CSV"}
      </Button>

      {result && (
        <div className="text-xs rounded-md border border-border p-3 space-y-1 max-h-40 overflow-y-auto">
          <p className="font-medium">
            {result.created} {schema.label.toLowerCase()}{result.created === 1 ? "" : "s"} created.
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="font-medium text-destructive">
                {result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped:
              </p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-muted-foreground">Row {err.row}: {err.error}</p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
