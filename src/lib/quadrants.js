// The four Eisenhower-matrix quadrants a task can sit in. One definition, so
// every picker, grid, filter and tooltip names them the same way. Quadrant 4
// also holds tasks with no quadrant yet (see taskUtils.getQuadrantCounts),
// which is why it reads "Later" rather than "Drop".
export const QUADRANTS = [
  { value: 1, name: "Do first", meaning: "Urgent and important" },
  { value: 2, name: "Schedule", meaning: "Important, not urgent" },
  { value: 3, name: "Delegate", meaning: "Urgent, not important" },
  { value: 4, name: "Later", meaning: "Neither urgent nor important" },
];

const BY_VALUE = Object.fromEntries(QUADRANTS.map((q) => [q.value, q]));

export function getQuadrant(value) {
  return BY_VALUE[Number(value)] || null;
}

// "1 · Do first" — the short form for selects, filters and tooltips.
export function quadrantLabel(value) {
  const q = getQuadrant(value);
  return q ? `${q.value} · ${q.name}` : "No quadrant";
}

// The task flags shown after the quadrant number in "1H", "2HQ".
export const TASK_FLAGS = {
  H: { name: "High importance", hint: "Matters more than its quadrant alone suggests" },
  Q: { name: "Quick task", hint: "Takes a few minutes; good for a gap in the day" },
};
