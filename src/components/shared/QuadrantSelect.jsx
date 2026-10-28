import QuadrantOptions from "@/components/shared/QuadrantOptions";
import { Select } from "@/components/ui/select";

// The quadrant <select> wrapper shared by TaskTable's row, TaskTable's new-
// task row, and ArchivedTaskList — was the same value/onChange/className/
// aria-label markup around <QuadrantOptions/> copy-pasted at each call site.
// `value`/`onChange` deal in the select's raw string value ("" for
// unassigned); each caller still decides what to do with it (mutate a real
// task vs hold it in local new-task state).
export default function QuadrantSelect({ value, onChange, ariaLabel, className = "" }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      // Fixed width: compact everywhere (it filled whole cards in the archive
      // list), and steady when the chosen option changes length.
      className={`w-36 shrink-0 text-[10px] px-1 py-0.5 ${className}`}
      aria-label={ariaLabel}
    >
      <QuadrantOptions />
    </Select>
  );
}
