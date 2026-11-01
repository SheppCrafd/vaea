// Calendar day keys ("2026-11-01") in the viewer's own time zone.
// toISOString() gives the UTC date, which files an evening event under the
// next day west of UTC and a morning one under the previous day east of it;
// new Date("2026-11-01") reads the key as UTC midnight, which shows the day
// before in the Americas.

const pad = (n) => String(n).padStart(2, "0");

export function localDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local midnight of a day key.
export function dateFromDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A calendar value as a Date: a date-only string (an all-day event, a due
// date) is that local day; anything else is parsed as given.
export function parseCalendarDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFromDayKey(value) : new Date(value);
}
