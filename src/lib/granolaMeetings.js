// Reads the meeting text Granola's MCP tools return. Granola says only
// "Meeting results are XML text, not JSON" and documents no layout, so this
// reads by meaning, not by exact tag names: a meeting is any element whose
// name mentions meeting/note/document and that carries an id; its title,
// date, people, link and summary may be attributes or child elements. When
// nothing parses, callers show Granola's text as it came (`raw`).
//
// A small tolerant parser instead of DOMParser: it runs in tests (Node) as
// well as the browser, and it survives an unclosed tag or a bare "&".

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const TAG = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTR = /([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

// -> { name: "#root", attrs: {}, children: [node | string] }
export function parseXml(text) {
  const root = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) top().children.push(decodeEntities(text.slice(last, m.index)));
    last = m.index + m[0].length;
    if (m[1] !== undefined) { top().children.push(m[1]); continue; }
    if (m[0].startsWith("<!--")) continue;
    if (m[2]) {
      // Closing tag: pop to the matching open element; ignore a stray close.
      const name = m[2].toLowerCase();
      const at = stack.map((n) => n.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs = {};
    for (const a of (m[4] || "").matchAll(ATTR)) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    const node = { name: m[3].toLowerCase(), attrs, children: [] };
    top().children.push(node);
    if (!m[5]) stack.push(node);
  }
  if (last < text.length) top().children.push(decodeEntities(text.slice(last)));
  return root;
}

export function textOf(node) {
  if (typeof node === "string") return node;
  return node.children.map(textOf).join("");
}

function elements(node, test, out = []) {
  for (const c of node.children) {
    if (typeof c === "string") continue;
    if (test(c)) out.push(c);
    elements(c, test, out);
  }
  return out;
}

// First matching attribute, else the text of the first matching child.
function field(node, names) {
  for (const n of names) if (node.attrs[n]) return node.attrs[n].trim();
  for (const c of node.children) {
    if (typeof c !== "string" && names.includes(c.name)) {
      const t = textOf(c).trim();
      if (t) return t;
    }
  }
  return "";
}

const MEETING_TAG = /meeting|note|document/;
const NOT_A_MEETING = /notes?_|private|summary|participants?|attendees?|folders?|attachments?|duplicate/;
const TITLE = ["title", "name", "meeting_title"];
const DATE = ["meeting_at", "date", "start", "start_time", "scheduled_start_time", "created_at"];
const URL_FIELDS = ["url", "note_url", "web_url", "link"];
const SUMMARY = ["summary", "summary_markdown", "summary_text", "enhanced_notes", "ai_summary", "notes"];
const PRIVATE = ["private_notes", "private_notes_markdown", "my_notes"];
const PERSON = /^(participant|attendee|invitee|person|creator|owner|organizer|organiser)$/;

function person(node) {
  const name = field(node, ["name", "display_name"]);
  const email = field(node, ["email"]);
  const text = node.children.every((c) => typeof c === "string") ? textOf(node).trim() : "";
  return name || text || email;
}

function isMeeting(node) {
  if (!MEETING_TAG.test(node.name) || NOT_A_MEETING.test(node.name)) return false;
  return Boolean(node.attrs.id || node.attrs.meeting_id || node.attrs.note_id || field(node, ["id"]));
}

function readMeeting(node) {
  const people = [];
  for (const p of elements(node, (n) => PERSON.test(n.name))) {
    const who = person(p);
    if (who && !people.includes(who)) people.push(who);
  }
  const url = field(node, URL_FIELDS) || (textOf(node).match(/https:\/\/[^\s"<>)]*granola[^\s"<>)]*/) || [""])[0];
  return {
    id: node.attrs.id || node.attrs.meeting_id || node.attrs.note_id || field(node, ["id"]),
    title: field(node, TITLE) || "Untitled meeting",
    date: field(node, DATE),
    people,
    url,
    summary: field(node, SUMMARY),
    privateNotes: field(node, PRIVATE),
  };
}

// -> { meetings: [...], nextCursor, raw }
export function parseMeetings(text) {
  const raw = (text || "").trim();
  if (!raw) return { meetings: [], nextCursor: "", raw };
  const root = parseXml(raw);
  // Outermost meeting elements only (a meeting may contain note children).
  const found = [];
  const walk = (node) => {
    for (const c of node.children) {
      if (typeof c === "string") continue;
      if (isMeeting(c)) found.push(c);
      else walk(c);
    }
  };
  walk(root);
  const seen = new Set();
  const meetings = found.map(readMeeting).filter((m) => m.id && !seen.has(m.id) && seen.add(m.id));
  const cursorNode = elements(root, (n) => n.name === "next_cursor" || n.attrs.next_cursor)[0];
  const nextCursor = cursorNode ? (cursorNode.attrs.next_cursor || textOf(cursorNode)).trim() : "";
  return { meetings, nextCursor, raw };
}

// Plain readable text for a meeting the parser couldn't structure: tags
// dropped, blank runs collapsed.
export function plainText(raw) {
  return textOf(parseXml(raw || "")).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function formatMeetingDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
