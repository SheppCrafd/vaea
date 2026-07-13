import { useAppStore } from "@/lib/store";

// Custom horizontal bar chart built with raw SVG <rect> elements — no charting library.
const STATUS_META = [
  { key: "todo", label: "To Do", varName: "--status-todo" },
  { key: "in_progress", label: "In Progress", varName: "--status-in-progress" },
  { key: "done", label: "Done", varName: "--status-done" },
];

export default function StatisticsChart() {
  const tasks = useAppStore((s) => s.tasks);
  const counts = STATUS_META.map((meta) => ({
    ...meta,
    count: tasks.filter((t) => t.status === meta.key).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  const chartWidth = 240;
  const rowHeight = 34;

  return (
    <svg width="100%" height={counts.length * rowHeight} viewBox={`0 0 ${chartWidth} ${counts.length * rowHeight}`}>
      {counts.map((c, idx) => (
        <g key={c.key} transform={`translate(0, ${idx * rowHeight})`}>
          <text x="0" y="12" fontSize="10" fill="hsl(var(--muted-foreground))">
            {c.label} · {c.count}
          </text>
          <rect
            x="0"
            y="18"
            width={(c.count / max) * chartWidth}
            height="8"
            rx="4"
            style={{ fill: `var(${c.varName}, #999)` }}
          />
        </g>
      ))}
    </svg>
  );
}