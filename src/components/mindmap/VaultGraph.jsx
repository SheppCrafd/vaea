import { useEffect, useRef, useState } from "react";
import { Network, Loader2, TriangleAlert, ZoomIn, ZoomOut, Maximize, X } from "lucide-react";
import { Link } from "react-router-dom";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { auditVaultNotes, writeVaultFile, readVaultNoteContent } from "@/lib/githubApi";
import { loadPhysics, savePhysics } from "@/lib/mindMapPhysics";
import { useAppStore } from "@/lib/store";
import MindMapPhysicsSettings from "@/components/mindmap/MindMapPhysicsSettings";
import NoteContentModal from "@/components/mindmap/NoteContentModal";

// Real rendering, built on Phase 2's vault auto-linking work: auditVaultNotes
// already returns every resolved [[wikilink]] (links) plus suggested_links
// (topically-related notes with no link yet — dashed here, since they're a
// suggestion, not a fact). A small self-contained force simulation (no
// external graph library — this app has no other charting dependency to
// justify pulling one in for a single page) settles node positions, drawn on
// canvas per this app's usual "generative graphics belong on canvas, not
// hand-authored SVG" rule. Split out of MindMapPage.jsx so the marketing
// demo (src/pages/marketing/MindMapPage.jsx) can render this exact same
// component — animated/non-interactive there via the `demo` prop — instead
// of a hand-drawn recreation.
//
// A LIVE simulation, not a one-shot layout: `tick()` below runs one physics
// step and is called every animation frame (stepSimulation, in the
// component) rather than 300 times synchronously up front. `alpha` is the
// standard force-layout "heat" — starts hot (1), cools every tick
// (ALPHA_DECAY) until it's cold enough to stop moving on its own, and gets
// reheated (resetAlpha) by a drag or a physics-setting change so the graph
// visibly re-settles instead of jumping to a new position. This is what
// makes "every other node dynamically react" to a drag true, not just the
// dragged one.
const ALPHA_DECAY = 0.985;
const ALPHA_MIN = 0.001;
const VELOCITY_DAMPING = 0.85;

function seedPositions(nodes, width, height) {
  const cx = width / 2, cy = height / 2;
  return new Map(nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = Math.min(width, height) / 3;
    return [n, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0, fixed: false }];
  }));
}

// Obsidian-style: nodes settle from repulsion + link springs + a real pull
// toward the canvas center. All four terms are user-tunable via
// MindMapPhysicsSettings (src/lib/mindMapPhysics.js), not fixed constants.
// A `fixed: true` node (currently being dragged) is never moved by the
// simulation itself — its position is set directly from the pointer instead
// — but it still exerts repulsion/spring forces on everything else, same as
// Obsidian's own "drag pins the node you're holding, physics keeps running
// around it."
function tick(nodes, positions, edges, width, height, physics, alpha) {
  const { centerGravity, repulsion, linkStrength, linkDistance } = physics;
  const cx = width / 2, cy = height / 2;
  for (const a of nodes) {
    const pa = positions.get(a);
    if (pa.fixed) continue;
    let fx = (cx - pa.x) * centerGravity;
    let fy = (cy - pa.y) * centerGravity;
    for (const b of nodes) {
      if (a === b) continue;
      const pb = positions.get(b);
      const dx = pa.x - pb.x, dy = pa.y - pb.y;
      const distSq = Math.max(dx * dx + dy * dy, 1);
      const force = repulsion / distSq;
      fx += (dx / Math.sqrt(distSq)) * force;
      fy += (dy / Math.sqrt(distSq)) * force;
    }
    pa.vx = (pa.vx + fx * alpha) * VELOCITY_DAMPING;
    pa.vy = (pa.vy + fy * alpha) * VELOCITY_DAMPING;
  }
  for (const { from, to } of edges) {
    const pa = positions.get(from), pb = positions.get(to);
    if (!pa || !pb) continue;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - linkDistance) * linkStrength * alpha;
    const fx = (dx / dist) * force, fy = (dy / dist) * force;
    if (!pa.fixed) { pa.vx += fx; pa.vy += fy; }
    if (!pb.fixed) { pb.vx -= fx; pb.vy -= fy; }
  }
  let moving = false;
  for (const n of nodes) {
    const p = positions.get(n);
    if (p.fixed) continue;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(30, Math.min(width - 30, p.x));
    p.y = Math.max(30, Math.min(height - 30, p.y));
    if (Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02) moving = true;
  }
  return moving;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const DRAG_THRESHOLD_PX = 4;
// A referentially-stable "no proposals" fallback for demo mode — see its
// own use below for the real infinite-loop bug this specifically avoids.
const EMPTY_ARRAY = [];

function titleOf(path) {
  return path.split("/").pop().replace(/\.md$/, "");
}

// A plain (non-demo) canvas — and an explicitly `interactive` demo — show a
// grab hand over a node and grab on drag; a passive demo keeps the page's
// normal cursor.
function canvasCursorClass(demo, hovered, interactive) {
  if (demo && !interactive) return "";
  if (hovered) return "cursor-grab active:cursor-grabbing";
  return "cursor-default active:cursor-grabbing";
}

// Stable per-tag hue — same tag always gets the same color within a
// session, no palette to maintain by hand as new tags show up.
function tagHue(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return hash % 360;
}

// Fixed sample graph for the marketing demo — real shape (links +
// suggested_links, same as a real auditVaultNotes() result), invented
// content (a marketing site can't read a real visitor's vault), rendered by
// the exact same draw/layout code path as the live app so the animation is
// never lying about what the real UI looks like.
const DEMO_GRAPH = {
  links: [
    { from: "Decisions/Auth Architecture.md", to: "Projects/Vaea.md" },
    { from: "Daily/2026-08-14.md", to: "Decisions/Auth Architecture.md" },
    { from: "Projects/Vaea.md", to: "People/Client.md" },
  ],
  suggested_links: [
    { a: "Decisions/Auth Architecture.md", b: "Decisions/Session Storage.md" },
  ],
  tags: {},
};

// `interactive` opts a demo graph back into pan / zoom / node-drag / hover
// (the marketing "Vaea Brain" hero wants a graph visitors can actually move
// around). Note-open, link-create, note-create and every GitHub write stay
// gated on a real (`!demo`) connection regardless.
export default function VaultGraph({ demo = false, interactive = false }) {
  const demoInert = demo && !interactive;
  const [connected, setConnected] = useState(demo ? true : null);
  const [connection, setConnection] = useState(null);
  const [graph, setGraph] = useState(demo ? DEMO_GRAPH : null);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);
  const [openNote, setOpenNote] = useState(null);
  const [physics, setPhysics] = useState(loadPhysics);
  // The graph stopped being a pure read view with this feature: a real new
  // note can be created directly on the canvas (double-click empty space),
  // and a real [[wikilink]] can be drawn directly between two existing
  // notes (shift-drag from one node to another). Both write straight to the
  // vault via githubApi.js, same as any other vault write — just triggered
  // from the graph instead of from chat.
  const [newNoteDraft, setNewNoteDraft] = useState(null); // { x, y, screenX, screenY, title } | null
  const [linkFrom, setLinkFrom] = useState(null); // node path currently being linked from, for the toolbar hint
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  // Note paths Vaea currently has a pending, not-yet-confirmed
  // WRITE_VAULT_NOTE proposal for (useChatController.js's
  // proposeVaultNotesIfAny) — rendered here as "new" nodes even though
  // they're not real notes yet. demo never has any (nothing to propose in a
  // fixed sample graph).
  //
  // A real, confirmed bug lived here: `useAppStore((s) => (demo ? [] : ...))`
  // returns a BRAND NEW `[]` literal every single render whenever demo is
  // true — Zustand's selector-identity check sees "changed" every time, so
  // the seeding effect below (keyed on `[graph, proposedPaths]`) re-ran
  // every render, called setView(), triggered another render, got another
  // new `[]`... a real infinite "Maximum update depth exceeded" loop on the
  // marketing site's Mind Map demo, caught via a live Playwright console-
  // error sweep. The selector itself now only ever picks the store's own
  // stable array reference — the demo branch is a plain expression in the
  // component body instead, using a module-level constant so it's
  // referentially stable across renders too.
  const storedProposedPaths = useAppStore((s) => s.pendingVaultProposals);
  const proposedPaths = demo ? EMPTY_ARRAY : storedProposedPaths;
  // Pan/zoom view state, not physics state — reset (demo excepted) never
  // resets these, so zooming in to inspect a cluster survives a physics
  // tweak or a hover redraw. { x, y } is the canvas-space point currently
  // centered under the container's own center; wheel-zoom keeps whatever
  // point is under the cursor fixed rather than always zooming toward center.
  const initialView = { scale: 1, x: 0, y: 0 };
  const [view, setViewState] = useState(initialView);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const positionsRef = useRef(null);
  const nodesRef = useRef([]);
  const alphaRef = useRef(1);
  const rafRef = useRef(null);
  // The current frame's closure, refreshed every effect run — lets pointer
  // handlers (outside that closure) restart the loop with `requestAnimationFrame(frameRef.current)`
  // when a drag begins after the graph had already cooled down and the loop
  // had gone idle (rafRef.current === null), instead of only reacting on
  // the next unrelated re-render.
  const frameRef = useRef(() => {});
  // Pointer interaction state lives in a ref, not React state — every one of
  // these updates on every mousemove frame, and re-rendering the component
  // for that would fight the canvas's own rAF loop for no benefit (nothing
  // here is read by JSX).
  const dragRef = useRef(null); // { kind: "node" | "pan", node?, startClientX, startClientY, moved }
  // view/hovered/physics mirrored into refs, read by the animation loop
  // instead of React state directly — the loop effect below only ever
  // depends on [graph, demo] (rare changes), NOT on view/hovered/physics
  // (which change on every pan/hover/wheel frame), so panning never tears
  // down and rebuilds the whole rAF loop + ResizeObserver on every pixel of
  // movement. That churn was the actual source of pan/zoom feeling
  // "snappy"/janky rather than smooth before this — state changes still
  // schedule React re-renders for the rest of the component (the physics
  // panel's own sliders, etc.), but the canvas loop itself never restarts
  // because of them.
  const viewRef = useRef(initialView);
  const hoveredRef = useRef(null);
  const physicsRef = useRef(physics);
  const proposedRef = useRef(new Set());
  const linkCursorRef = useRef(null); // graph-space point the in-progress shift-drag link line follows
  proposedRef.current = new Set(proposedPaths);
  const setView = (next) => {
    const resolved = typeof next === "function" ? next(viewRef.current) : next;
    viewRef.current = resolved;
    setViewState(resolved);
  };

  const updatePhysics = (next) => {
    physicsRef.current = next;
    setPhysics(next);
    savePhysics(next);
    alphaRef.current = 1; // reheat — a physics change should visibly re-settle, not silently apply
  };

  // Screen (client) coordinates -> graph-space coordinates, accounting for
  // the container's own on-page offset plus the current pan/zoom. Every
  // pointer handler below goes through this instead of raw clientX/Y.
  const toGraphSpace = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    const { scale, x, y } = viewRef.current;
    return {
      x: (clientX - rect.left - rect.width / 2) / scale + x,
      y: (clientY - rect.top - rect.height / 2) / scale + y,
    };
  };

  // Re-fetches the real graph from GitHub — the initial load below, and
  // also called directly after a graph-driven write (new note, new link)
  // instead of trying to hand-patch links/tags/positions locally, since
  // auditVaultNotes' resolution logic (broken links, suggested_links,
  // duplicates) isn't something worth re-implementing here just to avoid
  // one extra real fetch.
  const refreshGraph = async (conn) => {
    try {
      const result = await auditVaultNotes(conn);
      setGraph(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  useEffect(() => {
    if (demo) return;
    (async () => {
      const conn = await loadVaultConnection();
      const isConnected = isVaultConnected(conn);
      setConnected(isConnected);
      if (!isConnected) return;
      setConnection(conn);
      await refreshGraph(conn);
    })();
  }, [demo]);

  // Passive demo only: re-heat the simulation on an interval so the graph
  // keeps drifting in a slow loop instead of settling once and going still.
  // Just nudges the existing `alphaRef` the live loop already reads; skipped
  // under reduced-motion, and skipped for an interactive demo (there the
  // visitor moves it, and constant drift would fight them).
  useEffect(() => {
    if (!demoInert) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      alphaRef.current = 1;
    }, 5000);
    return () => clearInterval(id);
  }, [demoInert]);

  // Seeds nodes/positions once per real graph (not on every hover/physics/
  // view change) — dragging, panning, and zooming below all mutate this
  // SAME positions Map in place rather than replacing it, so a drag isn't
  // undone by the next unrelated re-render.
  useEffect(() => {
    if (!graph || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const nodeSet = new Set(Object.keys(graph.tags || {}));
    for (const l of graph.links || []) { nodeSet.add(l.from); nodeSet.add(l.to); }
    for (const l of graph.suggested_links || []) { nodeSet.add(l.a); nodeSet.add(l.b); }
    for (const p of proposedPaths) nodeSet.add(p);
    const nodes = [...nodeSet];
    nodesRef.current = nodes;
    positionsRef.current = nodes.length ? seedPositions(nodes, width, height) : null;
    alphaRef.current = 1;
    setView({ scale: 1, x: width / 2, y: height / 2 });
  }, [graph, proposedPaths]);

  // The live loop: one physics tick + one draw per animation frame, applying
  // the current pan/zoom as a canvas transform. Keeps running while alpha
  // hasn't cooled down yet OR a node is actively being dragged (dragging
  // always keeps the rest of the graph reacting live, regardless of alpha),
  // and goes idle otherwise instead of burning CPU forever on a settled
  // graph. `demo` still animates (the marketing page wants real motion) but
  // with no interaction wired in.
  //
  // Deliberately depends on [graph, demo] ONLY — view/hovered/physics are
  // read from their mirror refs every frame instead of closed over as state,
  // so panning/zooming/hovering/tweaking physics never tears down and
  // rebuilds this effect (and its ResizeObserver) on every single frame of
  // interaction. That churn was the real source of pan/zoom feeling
  // "snappy"/janky rather than smooth.
  useEffect(() => {
    if (!positionsRef.current || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let cancelled = false;

    const resize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(containerRef.current);

    const frame = () => {
      if (cancelled) return;
      const nodes = nodesRef.current;
      const positions = positionsRef.current;
      const currentView = viewRef.current;
      const currentPhysics = physicsRef.current;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dragging = dragRef.current?.kind === "node";
      if (alphaRef.current > ALPHA_MIN) {
        tick(nodes, positions, graph?.links || [], width, height, currentPhysics, alphaRef.current);
        alphaRef.current *= ALPHA_DECAY;
      }

      const style = getComputedStyle(document.documentElement);
      const border = `hsl(${style.getPropertyValue("--border")})`;
      const teal = `hsl(${style.getPropertyValue("--primary")})`;
      const fg = `hsl(${style.getPropertyValue("--foreground")})`;

      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2);
      ctx.scale(currentView.scale, currentView.scale);
      ctx.translate(-currentView.x, -currentView.y);

      ctx.strokeStyle = border;
      ctx.lineWidth = 1 / currentView.scale;
      ctx.setLineDash([]);
      for (const { from, to } of graph?.links || []) {
        const a = positions.get(from), b = positions.get(to);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = teal;
      ctx.setLineDash([4 / currentView.scale, 4 / currentView.scale]);
      for (const { a: fromPath, b: toPath } of graph?.suggested_links || []) {
        const a = positions.get(fromPath), b = positions.get(toPath);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // The in-progress shift-drag link — a live preview of the real
      // [[wikilink]] that lands on release, so dragging toward empty space
      // (which cancels) looks visibly different from dragging toward a
      // real target the moment it's under the cursor.
      if (dragRef.current?.kind === "link" && linkCursorRef.current) {
        const from = positions.get(dragRef.current.node);
        const targetNode = nodeAt(linkCursorRef.current.x, linkCursorRef.current.y);
        ctx.strokeStyle = teal;
        ctx.lineWidth = (targetNode ? 2 : 1) / currentView.scale;
        ctx.setLineDash(targetNode ? [] : [4 / currentView.scale, 4 / currentView.scale]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(linkCursorRef.current.x, linkCursorRef.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const n of nodes) {
        const p = positions.get(n);
        const isProposed = proposedRef.current.has(n);
        // Inverted from the link convention on purpose (per design): a
        // proposed LINK is accent/dashed and an existing link is grey, but a
        // proposed NODE is grey (nothing there yet) and an existing node is
        // accent — so accent always means "already real" and the visual
        // language stays consistent between links and nodes even though the
        // colors swap which state they attach to.
        const tag = !isProposed && currentPhysics.groupByTag ? (graph?.tags?.[n] || [])[0] : null;
        const isHot = hoveredRef.current === n || (dragging && dragRef.current.node === n);
        const nodeColor = isProposed ? border : tag ? `hsl(${tagHue(tag)}, 55%, 55%)` : teal;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHot ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();
        ctx.font = `${11 / currentView.scale}px Inter, sans-serif`;
        ctx.fillStyle = fg;
        ctx.textAlign = "center";
        ctx.fillText(titleOf(n), p.x, p.y - 10 / currentView.scale);
      }
      ctx.restore();

      if (demo || alphaRef.current > ALPHA_MIN || dragging) rafRef.current = requestAnimationFrame(frame);
      else rafRef.current = null;
    };
    frameRef.current = frame;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [graph, demo]);

  const nodeAt = (graphX, graphY) => {
    if (!positionsRef.current) return null;
    let closest = null, closestDist = 14 / viewRef.current.scale;
    for (const [n, p] of positionsRef.current) {
      const dist = Math.hypot(p.x - graphX, p.y - graphY);
      if (dist < closestDist) { closest = n; closestDist = dist; }
    }
    return closest;
  };

  const handlePointerDown = (e) => {
    if (demoInert) return;
    const { x, y } = toGraphSpace(e.clientX, e.clientY);
    const node = nodeAt(x, y);
    // Shift-drag from a node draws a real [[wikilink]] instead of moving
    // it — the graph's own "create a connection" gesture, same modifier
    // convention as most diagram tools use to distinguish "move" from
    // "connect."
    if (node && e.shiftKey && !demo) {
      dragRef.current = { kind: "link", node, moved: false, startClientX: e.clientX, startClientY: e.clientY };
      linkCursorRef.current = { x, y };
      setLinkFrom(node);
    } else {
      dragRef.current = node
        ? { kind: "node", node, moved: false, startClientX: e.clientX, startClientY: e.clientY }
        : { kind: "pan", moved: false, startClientX: e.clientX, startClientY: e.clientY, startView: viewRef.current };
      if (node) {
        const p = positionsRef.current.get(node);
        p.fixed = true;
        alphaRef.current = 1;
      }
    }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (demoInert) return;
    const drag = dragRef.current;
    if (!drag) {
      const { x, y } = toGraphSpace(e.clientX, e.clientY);
      const node = nodeAt(x, y);
      if (node !== hoveredRef.current) {
        hoveredRef.current = node;
        setHovered(node); // only for the JSX cursor style below — the loop itself reads hoveredRef
        if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current); // repaint the new hover state even on a cold/settled graph
      }
      return;
    }
    const dxClient = e.clientX - drag.startClientX, dyClient = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dxClient, dyClient) > DRAG_THRESHOLD_PX) drag.moved = true;
    if (drag.kind === "node") {
      const p = positionsRef.current.get(drag.node);
      const { x, y } = toGraphSpace(e.clientX, e.clientY);
      p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    } else if (drag.kind === "link") {
      linkCursorRef.current = toGraphSpace(e.clientX, e.clientY);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current);
    } else if (drag.moved) {
      setView((v) => ({ ...v, x: drag.startView.x - dxClient / v.scale, y: drag.startView.y - dyClient / v.scale }));
      if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current); // repaint the new pan offset even on a cold/settled graph
    }
  };

  // Demo mode never opens a note — nothing real to read for an invented
  // sample graph, same "hover/persistence disabled" boundary the rest of
  // this component already draws for marketing use. A drag that actually
  // moved never opens the note either — only a genuine click (pointerdown +
  // pointerup with no real movement) does, same click-vs-drag distinction
  // WorkflowCanvas.jsx doesn't need (its cards have no separate "open" action).
  const handlePointerUp = () => {
    if (demoInert) return;
    const drag = dragRef.current;
    if (drag?.kind === "node") {
      positionsRef.current.get(drag.node).fixed = false;
      if (!drag.moved && !demo) setOpenNote(drag.node);
    } else if (drag?.kind === "link" && !demo && linkCursorRef.current) {
      const target = nodeAt(linkCursorRef.current.x, linkCursorRef.current.y);
      if (target && target !== drag.node) createLinkBetween(drag.node, target);
    }
    dragRef.current = null;
    linkCursorRef.current = null;
    setLinkFrom(null);
  };

  // Double-click on the open background creates a real new note — the
  // graph's own "add a node" gesture. Double-clicking a node instead just
  // does nothing extra here (a plain click already opens it); this only
  // fires when nodeAt comes back empty.
  const handleDoubleClick = (e) => {
    if (demo) return;
    const { x, y } = toGraphSpace(e.clientX, e.clientY);
    if (nodeAt(x, y)) return;
    const rect = containerRef.current.getBoundingClientRect();
    setNewNoteDraft({ x, y, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top, title: "" });
  };

  // Shift-drag-to-link and double-click-to-create both write straight to
  // GitHub via githubApi.js — no confirm step, unlike the same actions
  // proposed through chat (WRITE_VAULT_NOTE), because this IS the direct
  // manipulation surface already: dragging a card in Workflows or typing in
  // a note's own editor doesn't ask for confirmation either. Errors surface
  // inline (actionError) rather than as a thrown exception with nowhere to
  // land.
  const createLinkBetween = async (fromPath, toPath) => {
    if (!connection) return;
    setSaving(true);
    setActionError("");
    try {
      const content = await readVaultNoteContent({ ...connection, branch: connection.branch || "main", path: fromPath });
      const linkLine = `[[${titleOf(toPath)}]]`;
      const nextContent = content.includes(linkLine) ? content : `${content.replace(/\s+$/, "")}\n\n${linkLine}\n`;
      await writeVaultFile({
        ...connection,
        branch: connection.branch || "main",
        path: fromPath,
        content: nextContent,
        commitMessage: `Link ${titleOf(fromPath)} -> ${titleOf(toPath)} via Vaea Mind Map`,
      });
      await refreshGraph(connection);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createNoteFromDraft = async () => {
    if (!connection || !newNoteDraft?.title.trim()) return;
    const title = newNoteDraft.title.trim();
    setSaving(true);
    setActionError("");
    try {
      await writeVaultFile({
        ...connection,
        branch: connection.branch || "main",
        path: `${title}.md`,
        content: `# ${title}\n`,
        commitMessage: `Create ${title}.md via Vaea Mind Map`,
      });
      const fresh = await refreshGraph(connection);
      // Seed the brand-new note near where it was created rather than
      // wherever the next full re-seed's default layout would place it —
      // only matters if the seeding effect's own re-seed (keyed on `graph`
      // identity) hasn't already run by the time this resolves; harmless
      // no-op otherwise since that effect will just overwrite it.
      if (fresh && positionsRef.current && !positionsRef.current.has(`${title}.md`)) {
        positionsRef.current.set(`${title}.md`, { x: newNoteDraft.x, y: newNoteDraft.y, vx: 0, vy: 0, fixed: false });
      }
      setNewNoteDraft(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWheel = (e) => {
    if (demoInert) return;
    // Only actually prevents the page from scrolling under the canvas when
    // this handler is attached as a real, non-passive DOM listener (see the
    // useEffect below) — React's own onWheel prop attaches passively by
    // default, where preventDefault() is silently ignored (a real, console-
    // warned bug this used to have: zooming the graph also scrolled the
    // page behind it).
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cursorGraph = toGraphSpace(e.clientX, e.clientY);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewRef.current.scale * (1 - e.deltaY * 0.001)));
    // Keep the point under the cursor fixed in place while zooming, not the
    // canvas center — the standard "zoom toward cursor" feel, same as
    // Obsidian's own graph and every map/diagram app.
    const cx = e.clientX - rect.left - rect.width / 2, cy = e.clientY - rect.top - rect.height / 2;
    setView({ scale: nextScale, x: cursorGraph.x - cx / nextScale, y: cursorGraph.y - cy / nextScale });
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current); // repaint the new zoom level even on a cold/settled graph
  };
  // React's onWheel prop attaches as a passive listener, where
  // preventDefault() is silently ignored — a real bug this used to have
  // (confirmed via a real browser pass: "Unable to preventDefault inside
  // passive event listener invocation" in the console, and the page
  // genuinely scrolling underneath the graph while zooming). Attaching
  // wheel natively with { passive: false } is the only way to actually
  // stop that. wheelHandlerRef holds the latest closure so this effect
  // only needs to attach the listener once per canvas element, not
  // re-attach on every render.
  const wheelHandlerRef = useRef(handleWheel);
  wheelHandlerRef.current = handleWheel;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const listener = (e) => wheelHandlerRef.current(e);
    canvas.addEventListener("wheel", listener, { passive: false });
    return () => canvas.removeEventListener("wheel", listener);
  }, [graph]); // canvasRef.current only exists once the canvas branch renders, gated on `graph`

  // Same "toward center" zoom the buttons below use — cursor position isn't
  // meaningful for a button click, unlike the wheel handler above.
  const zoomByFactor = (factor) => {
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewRef.current.scale * factor));
    setView((v) => ({ ...v, scale: nextScale }));
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current);
  };
  const resetView = () => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setView({ scale: 1, x: width / 2, y: height / 2 });
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frameRef.current);
  };

  const nodeCount = graph
    ? new Set([
        ...(graph.links || []).flatMap((l) => [l.from, l.to]),
        ...(graph.suggested_links || []).flatMap((l) => [l.a, l.b]),
        ...Object.keys(graph.tags || {}),
        ...proposedPaths,
      ]).size
    : 0;

  return (
    <div className="flex-1 min-h-0 overflow-hidden relative" ref={containerRef}>
      {!demo && graph && nodeCount > 0 ? (
        <MindMapPhysicsSettings physics={physics} onChange={updatePhysics} />
      ) : null}
      {connected === false ? (
        <div className="max-w-2xl mx-auto pt-4">
          <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
            <Network className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Connect your Vaea Brain first</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              The map is built from how your real notes link to each other.
            </p>
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1.5 text-sm mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              Go to Settings
            </Link>
          </div>
        </div>
      ) : error ? (
        <div className="max-w-2xl mx-auto pt-4">
          <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
            <TriangleAlert className="w-6 h-6 text-destructive mx-auto mb-3" />
            <p className="text-sm font-medium">Couldn't read your Vaea Brain</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              GitHub returned: {error}. This usually means the access token
              expired or lost repo access — reconnect it and the map will
              rebuild.
            </p>
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1.5 text-sm mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              Check connection in Settings
            </Link>
          </div>
        </div>
      ) : !graph ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground py-6 max-w-2xl mx-auto">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading your vault…
        </div>
      ) : (
        <>
          {nodeCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {demo ? "No connections yet." : "Double-click anywhere to create your first note."}
              </p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className={`w-full h-full touch-none ${canvasCursorClass(demo, hovered, interactive)}`}
          />
        </>
      )}

      {(!demo || interactive) && graph ? (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 rounded-md bg-card/90 border border-border shadow-sm backdrop-blur-sm p-0.5">
          <button
            type="button"
            onClick={() => zoomByFactor(1 / 1.3)}
            aria-label="Zoom out"
            title="Zoom out"
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-center select-none">{Math.round(view.scale * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomByFactor(1.3)}
            aria-label="Zoom in"
            title="Zoom in"
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset view"
            title="Reset view"
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {!demo && newNoteDraft && (
        <form
          onSubmit={(e) => { e.preventDefault(); createNoteFromDraft(); }}
          style={{ left: newNoteDraft.screenX, top: newNoteDraft.screenY }}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-card border border-border rounded-lg shadow-lg p-1.5"
        >
          <input
            autoFocus
            value={newNoteDraft.title}
            onChange={(e) => setNewNoteDraft((d) => ({ ...d, title: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Escape") setNewNoteDraft(null); }}
            placeholder="New note title"
            disabled={saving}
            className="text-xs px-2 py-1 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary/50 w-40"
          />
          <button type="submit" disabled={saving || !newNoteDraft.title.trim()} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md disabled:opacity-50">
            {saving ? "..." : "Create"}
          </button>
          <button type="button" onClick={() => setNewNoteDraft(null)} className="text-xs px-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {!demo && linkFrom && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[11px] text-muted-foreground bg-card/90 border border-border rounded-md px-2.5 py-1 shadow-sm backdrop-blur-sm">
          Drop on a note to link "{titleOf(linkFrom)}" to it — drop on empty space to cancel
        </div>
      )}

      {!demo && actionError && (
        <p className="absolute bottom-2 left-2 z-10 max-w-xs flex items-start gap-1.5 text-[11px] text-destructive bg-card/90 border border-destructive/30 rounded-md px-2 py-1.5 shadow-sm backdrop-blur-sm">
          <TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" /> {actionError}
        </p>
      )}

      {openNote && connection && (
        <NoteContentModal
          path={openNote}
          connection={connection}
          onClose={() => setOpenNote(null)}
          onSaved={() => refreshGraph(connection)}
        />
      )}
    </div>
  );
}
