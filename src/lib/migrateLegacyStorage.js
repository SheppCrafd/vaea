// One-time migration from the app's pre-rename localStorage key names
// (portfolio_tracker_*, from when this app was called Portfolio Tracker)
// to the current vaea_* names, for the small cosmetic/UI-state keys that
// still legitimately live in localStorage (theme, sidebar state, chat
// widget position, etc). Copies forward rather than moving — old keys are
// left in place, so this stays a safe no-op on every run after the first
// (new key already exists) rather than something that could lose data if
// it ever ran twice.
//
// Entity data (areas/products/etc.) is NOT handled here — it moved off
// localStorage entirely (see deviceStorage.js). localDb.js's own
// readLegacyLocalStorageData() checks both the portfolio_tracker_db_* and
// vaea_db_* prefixes directly when carrying a returning user's data over to
// the new backend, so there's nothing left for this module to rename there.
const KEY_RENAMES = [
  ["portfolio_tracker_accent_theme", "vaea_accent_theme"],
  ["portfolio_tracker_left_sidebar_open", "vaea_left_sidebar_open"],
  ["portfolio_tracker_right_sidebar_open", "vaea_right_sidebar_open"],
  ["portfolio_tracker_chat_icon", "vaea_chat_icon"],
  ["portfolio_tracker_chat_active_session", "vaea_chat_active_session"],
  ["portfolio_tracker_card_view", "vaea_card_view"],
  ["portfolio_tracker_chat_geometry", "vaea_chat_geometry"],
];

function copyIfMissing(oldKey, newKey) {
  if (localStorage.getItem(newKey) === null && localStorage.getItem(oldKey) !== null) {
    localStorage.setItem(newKey, localStorage.getItem(oldKey));
  }
}

// Must run before anything reads a vaea_* key for the first time (every
// useState(loadX) initializer across the cosmetic-state hooks/context in
// this list) — called synchronously at the top of main.jsx, before the app
// renders, so there's no ordering gap.
export function migrateLegacyStorageKeys() {
  try {
    KEY_RENAMES.forEach(([oldKey, newKey]) => copyIfMissing(oldKey, newKey));
  } catch {
    // best-effort — private browsing/storage-disabled environments just skip migration
  }
}
