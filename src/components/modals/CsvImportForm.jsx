import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAreas } from "@/hooks/useAreas";
import { useProducts } from "@/hooks/useProducts";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { parseCsv, toCsv } from "@/lib/csv";
import { CSV_TEMPLATE_COLUMNS, CSV_TEMPLATE_EXAMPLE_ROWS, buildWorkspaceRows, buildHierarchyPlan, countActionsByType } from "@/lib/csvImport";
import { executeActionSequence } from "@/lib/chatActions";

const LABELS = { area: "area", product: "product", project: "project", task: "task" };

function downloadCsvFile(rows) {
  const csv = toCsv(CSV_TEMPLATE_COLUMNS, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vaea-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Bulk-create tab of the Create New popover: one CSV, any mix of areas/
// products/projects/tasks in a single file. Each row spells out the full
// parent path down to whatever it's adding (leave deeper columns blank once
// you've reached that level) — repeating a title across rows attaches to
// the same record rather than creating a duplicate. Builds an ordered plan
// with temp_id chaining and runs it through chatActions.js's
// executeActionSequence, the exact mechanism the AI chat assistant's own
// multi-step plans use — one creation implementation, not a second copy.
export default function CsvImportForm() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null); // { counts, errors }
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: areas = [] } = useAreas();
  const { data: products = [] } = useProducts();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useAllTasks();

  // The template downloads pre-filled with the current workspace (active
  // records only — these hooks already exclude archived and deleted): a
  // ready inventory to edit and re-import, since unchanged rows reuse their
  // existing records rather than duplicating. Only a completely empty
  // workspace falls back to the worked example rows.
  const downloadTemplate = () => {
    const rows = buildWorkspaceRows({ areas, products, projects, tasks });
    downloadCsvFile(rows.length ? rows : CSV_TEMPLATE_EXAMPLE_ROWS);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a failed import
    if (!file) return;

    setIsImporting(true);
    setResult(null);
    try {
      const text = await file.text();
      const { records } = parseCsv(text);
      const { actions, errors } = buildHierarchyPlan(records, { areas, products, projects, tasks });
      if (actions.length) {
        await executeActionSequence(actions);
        ["areas", "products", "projects", "tasks"].forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        );
      }
      setResult({ counts: countActionsByType(actions), errors });
    } catch (error) {
      setResult({ counts: { area: 0, product: 0, project: 0, task: 0 }, errors: [{ row: "-", error: error.message || "Couldn't read that file." }] });
    } finally {
      setIsImporting(false);
    }
  };

  const totalCreated = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        One file covers everything — each row can describe an area, a product inside it, a project inside that, and a task inside that. Leave a column blank once you've reached the level you're adding; repeat the same title on another row to attach more to it instead of creating a duplicate.
      </p>

      <Button type="button" variant="outline" className="w-full" onClick={downloadTemplate}>
        Download Template
      </Button>

      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      <Button type="button" className="w-full" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
        {isImporting ? "Importing..." : "Import CSV"}
      </Button>

      {result && (
        <div className="text-xs rounded-md border border-border p-3 space-y-1 max-h-40 overflow-y-auto">
          <p className="font-medium">
            {totalCreated === 0
              ? "Nothing created."
              : Object.entries(result.counts)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => `${count} ${LABELS[key]}${count === 1 ? "" : "s"}`)
                  .join(", ") + " created."}
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
