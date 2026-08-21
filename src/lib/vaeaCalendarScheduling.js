// Real free-slot finding for Vaea Calendar's auto-scheduling — client-side,
// works over whatever calendar connectors (Google Workspace/Microsoft 365)
// are already connected. No recurrence-rule support yet: a "habit" or
// "focus" block is created as one event per occurrence over the requested
// span rather than a true RRULE — simpler, still real, and every occurrence
// is independently visible/movable, which a single RRULE event wouldn't be
// through this app's own read/update calls anyway.
export const VAEA_TAG = {
  task: "[Vaea: scheduled task]",
  focus: "[Vaea: protected focus block]",
  habit: "[Vaea: habit]",
};

const WORK_HOUR_START = 9;
const WORK_HOUR_END = 18;
const SLOT_STEP_MINUTES = 30;

function toRange(event) {
  const start = new Date(event.start?.dateTime || event.start?.date || event.start);
  const end = new Date(event.end?.dateTime || event.end?.date || event.end);
  return { start, end };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Scans business hours (9am-6pm, the day's own local time), in 30-minute
// increments, from `earliest` up to `latest` (or 14 days out), for the
// first gap at least `durationMinutes` long that doesn't overlap any event
// in `busyEvents`. Returns null if nothing free turns up in the window.
export function findFreeSlot(busyEvents, { durationMinutes, earliest, latest }) {
  const busy = busyEvents.map(toRange);
  const searchStart = earliest ? new Date(earliest) : new Date();
  const searchEnd = latest ? new Date(latest) : new Date(searchStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  const cursor = new Date(searchStart);
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES, 0, 0);

  while (cursor < searchEnd) {
    const hour = cursor.getHours();
    if (hour < WORK_HOUR_START) {
      cursor.setHours(WORK_HOUR_START, 0, 0, 0);
      continue;
    }
    if (hour >= WORK_HOUR_END) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_HOUR_START, 0, 0, 0);
      continue;
    }
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
    if (slotEnd.getHours() > WORK_HOUR_END || (slotEnd.getHours() === WORK_HOUR_END && slotEnd.getMinutes() > 0)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_HOUR_START, 0, 0, 0);
      continue;
    }
    const conflict = busy.some((b) => overlaps(cursor, slotEnd, b.start, b.end));
    if (!conflict) return { start: new Date(cursor), end: slotEnd };
    cursor.setMinutes(cursor.getMinutes() + SLOT_STEP_MINUTES);
  }
  return null;
}

// One free slot per requested day, `count` days apart — the habit/focus
// block occurrence generator. `daysOfWeek` (0=Sunday) restricts which days
// are eligible; omit for every day.
export function findRecurringSlots(busyEvents, { durationMinutes, occurrences, daysOfWeek, startingFrom }) {
  const slots = [];
  let cursor = startingFrom ? new Date(startingFrom) : new Date();
  let guard = 0;
  while (slots.length < occurrences && guard < occurrences * 30) {
    guard++;
    if (!daysOfWeek || daysOfWeek.includes(cursor.getDay())) {
      const dayStart = new Date(cursor);
      dayStart.setHours(WORK_HOUR_START, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(WORK_HOUR_END, 0, 0, 0);
      const slot = findFreeSlot(busyEvents, { durationMinutes, earliest: dayStart, latest: dayEnd });
      if (slot) slots.push(slot);
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

// Which of `events` are Vaea-auto-scheduled (any of the three VAEA_TAG
// prefixes in the description) AND overlap something else on the calendar
// that ISN'T itself Vaea-tagged — the real conflicts dynamic reschedule
// should actually move, not every double-booking on the calendar.
export function findConflicts(events) {
  const tagged = events.filter((e) => Object.values(VAEA_TAG).some((tag) => (e.description || "").includes(tag)));
  const untagged = events.filter((e) => !Object.values(VAEA_TAG).some((tag) => (e.description || "").includes(tag)));
  const conflicts = [];
  for (const t of tagged) {
    const tr = toRange(t);
    const conflictsWith = untagged.filter((u) => {
      const ur = toRange(u);
      return overlaps(tr.start, tr.end, ur.start, ur.end);
    });
    if (conflictsWith.length) conflicts.push({ event: t, conflictsWith });
  }
  return conflicts;
}
