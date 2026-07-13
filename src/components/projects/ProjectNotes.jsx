// Renders risks (⚠️) and questions (❓) attached to a project.
export default function ProjectNotes({ notes }) {
  if (!notes?.length) return null;

  return (
    <ul className="space-y-1 mt-2">
      {notes.map((note, idx) => (
        <li key={idx} className="text-xs flex items-start gap-1.5">
          <span aria-hidden="true">{note.type === "risk" ? "⚠️" : "❓"}</span>
          <span className="text-muted-foreground">{note.text}</span>
        </li>
      ))}
    </ul>
  );
}