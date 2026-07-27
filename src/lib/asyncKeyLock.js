// A tiny per-key FIFO async lock. Every call for the same key runs strictly
// after the previous one for that key has settled, so two concurrent
// "read the current value, merge in a change, write it back" cycles against
// the same underlying storage key can never interleave — see localDb.js
// (one lock per entity collection) and chatActions.js's SET_AI_IDENTITY
// (one lock for the identity key) for the two real races this closes: a
// silent lost-update (both callers read the same stale value, whichever
// writes back last wins) and, in File System Access storage mode
// specifically, two overlapping createWritable() streams on the very same
// file, which Chromium surfaces as a real browser error: "An operation that
// depends on state cached in an interface object was made but the state
// had changed since it was read from disk."
const queues = new Map(); // key -> Promise (tail of that key's queue)

export function withKeyLock(key, fn) {
  const prior = queues.get(key) || Promise.resolve();
  // Never let one failed op wedge the queue for whoever's waiting behind it —
  // each op still sees (and reports) its own real outcome via `result` below.
  const settledPrior = prior.catch(() => {});
  const result = settledPrior.then(fn);
  queues.set(key, result.catch(() => {}));
  return result;
}
