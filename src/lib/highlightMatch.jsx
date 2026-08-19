// Wraps the substring of `text` that matches `query` (case-insensitive) in a
// <mark> so a fast typist can visually confirm *why* a result matched
// without having to reread the whole line — used by the command palette's
// search results. Returns `text` unchanged when there's no query or no
// match (quick actions have no query to highlight against).
export function highlightMatch(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-inherit rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
