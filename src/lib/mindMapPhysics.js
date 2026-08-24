// Obsidian-style graph physics — real, persisted per device (localStorage,
// same pattern as chatIcon.js's ICON_STORAGE_KEY), not a session-only
// state. These feed VaultGraph.jsx's force simulation directly: nothing
// here is decorative, every value below changes how the graph actually
// settles.
const PHYSICS_STORAGE_KEY = "vaea_mindmap_physics";

export const DEFAULT_PHYSICS = {
  centerGravity: 0.03, // how hard nodes are pulled toward the canvas center
  repulsion: 2400, // how hard nodes push each other apart (node-node)
  linkStrength: 0.02, // how hard a real [[wikilink]] pulls its two nodes together
  linkDistance: 90, // the length a link "wants" to settle at
  groupByTag: false, // color nodes by their first shared tag instead of one flat color
};

export const PHYSICS_FIELDS = [
  { key: "centerGravity", label: "Center gravity", min: 0, max: 0.15, step: 0.005 },
  { key: "repulsion", label: "Node push", min: 400, max: 6000, step: 100 },
  { key: "linkStrength", label: "Link pull", min: 0.005, max: 0.08, step: 0.005 },
  { key: "linkDistance", label: "Link length", min: 30, max: 220, step: 10 },
];

export function loadPhysics() {
  try {
    const raw = localStorage.getItem(PHYSICS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_PHYSICS, ...parsed };
  } catch {
    return DEFAULT_PHYSICS;
  }
}

export function savePhysics(physics) {
  try {
    localStorage.setItem(PHYSICS_STORAGE_KEY, JSON.stringify(physics));
  } catch {
    // Storage can be unavailable (private browsing, quota) — the setting
    // still applies for this session via component state either way.
  }
}
