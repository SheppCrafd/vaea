// The AI chat previously only ever saw a bare UTC date (`new Date()
// .toISOString().slice(0, 10)`, computed server-side for base44-hosted chat)
// — no time at all, and wrong for a large share of users outright: a server
// clock in UTC disagrees with "today" for anyone not near that timezone,
// especially close to midnight (a task due "today" at 11pm Pacific could
// already read as tomorrow server-side). This is the one real source of
// truth for "what time/date is it right now, for THIS user" — computed
// client-side (the browser always knows its own real local time/timezone,
// unlike a server), then threaded through: BYOK/Local Mode use it
// directly (systemPrompt.js, already running client-side); base44-hosted
// chat sends it up in the request body (useChatController.js) since
// entry.ts's own server-side `new Date()` has no way to know the user's
// real timezone at all.
export function getNowContext(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  // Local (not UTC) calendar date — what "today" actually means to this
  // user, for due-date reasoning and for filenames like Daily/YYYY-MM-DD.md.
  const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const display = `${weekday}, ${isoDate}, ${time} (${timeZone})`;
  return { display, isoDate, timeZone };
}
