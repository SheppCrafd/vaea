import { QUADRANTS } from "@/lib/quadrants";

// The `<option>` list for a task's quadrant (1-4, or blank/unassigned) —
// identical across every quadrant `<select>` in the app (TaskTable's row and
// new-row, ArchivedTaskList, TaskForm). Renders only the options, so each
// caller keeps full control of its own `<select>`'s value/onChange/className.
export default function QuadrantOptions() {
  return (
    <>
      <option value="">No quadrant</option>
      {QUADRANTS.map((q) => (
        <option key={q.value} value={String(q.value)} title={q.meaning}>
          {q.value} · {q.name}
        </option>
      ))}
    </>
  );
}
