// Static 4-quadrant block showing hardcoded task counts per project.
export default function ProjectQuadrant({ quadrant }) {
  const cells = [
    { label: "To Do", value: quadrant.q1 },
    { label: "In Progress", value: quadrant.q2 },
    { label: "Review", value: quadrant.q3 },
    { label: "Done", value: quadrant.q4 },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 text-center">
      {cells.map((c) => (
        <div key={c.label} className="bg-muted rounded p-1.5">
          <div className="text-sm font-semibold">{c.value}</div>
          <div className="text-[10px] text-muted-foreground">{c.label}</div>
        </div>
      ))}
    </div>
  );
}