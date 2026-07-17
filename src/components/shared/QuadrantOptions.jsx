// The `<option>` list for a task's quadrant (1-4, or blank/unassigned) —
// identical across every quadrant `<select>` in the app (TaskTable's row and
// new-row, ArchivedTaskList, TaskForm). Renders only the options, so each
// caller keeps full control of its own `<select>`'s value/onChange/className.
export default function QuadrantOptions() {
  return (
    <>
      <option value="">—</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
    </>
  );
}
