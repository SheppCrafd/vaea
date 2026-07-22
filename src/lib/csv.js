// Minimal RFC4180-ish CSV parse/stringify — comma-delimited, double-quote
// quoting with "" as an escaped quote, quoted fields may contain commas or
// newlines. No external dependency: the app is deliberately dependency-light
// (see README's enterprise section), and this is a small, fully-testable
// state machine — not worth a library for.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += char; i += 1; continue;
    }
    if (char === '"') { inQuotes = true; i += 1; continue; }
    if (char === ",") { pushField(); i += 1; continue; }
    if (char === "\r") { i += 1; continue; } // swallow — \n (or EOF) ends the row
    if (char === "\n") { pushRow(); i += 1; continue; }
    field += char; i += 1;
  }
  // Trailing field/row — the file may or may not end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  // A trailing newline (or a blank final line) parses to one phantom empty
  // row ([""]) — drop it rather than surfacing it as a bogus data row.
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  if (rows.length === 0) return { headers: [], records: [] };

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());
  const records = dataRows.map((cells) => {
    const record = {};
    headers.forEach((h, idx) => { record[h] = (cells[idx] ?? "").trim(); });
    return record;
  });
  return { headers, records };
}

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers, records) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const record of records) {
    lines.push(headers.map((h) => csvEscape(record[h])).join(","));
  }
  return lines.join("\r\n");
}
