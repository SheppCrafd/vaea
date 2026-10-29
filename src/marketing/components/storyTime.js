// Time math for the story timeline (story.jsx), kept free of browser code
// so it can be tested.

// "8:52 AM" -> minutes since midnight.
export function toMinutes(label) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((label || "").trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

export const hourLabel = (minutes, short) => {
  const h24 = Math.floor(minutes / 60) % 24;
  const h = h24 % 12 || 12;
  return short ? String(h) : `${h} ${h24 < 12 ? "AM" : "PM"}`;
};


// Exported for tests: the story time at the reading line, given each beat's
// minutes and its top edge on screen. Between two beats the time moves in
// proportion to how far the reader has scrolled from one to the next.
export function timeAtLine(beats, line) {
  if (!beats.length) return null;
  if (line <= beats[0].top) return beats[0].minutes;
  for (let i = 0; i < beats.length - 1; i++) {
    const a = beats[i];
    const b = beats[i + 1];
    if (line >= a.top && line < b.top) return a.minutes + ((b.minutes - a.minutes) * (line - a.top)) / (b.top - a.top);
  }
  return beats[beats.length - 1].minutes;
}
