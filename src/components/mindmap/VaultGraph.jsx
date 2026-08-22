import { useEffect, useRef, useState } from "react";
import { Network, Loader2, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { auditVaultNotes } from "@/lib/githubApi";
import { loadPhysics, savePhysics } from "@/lib/mindMapPhysics";
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
const MAX_ITERATIONS = 300;

// Obsidian-style: nodes settle from repulsion + link springs + a real pull
// toward the canvas center (previously missing entirely — only a hard
// boundary clamp kept nodes on-canvas, which reads very differently from a
// graph that actually centers itself). All four terms are user-tunable via
// MindMapPhysicsSettings (src/lib/mindMapPhysics.js), not fixed constants.
function runForceLayout(nodes, edges, width, height, physics) {
  const { centerGravity, repulsion, linkStrength, linkDistance } = physics;
  const cx = width / 2, cy = height / 2;
  const positions = new Map(nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = Math.min(width, height) / 3;
    return [n, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 }];
  }));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    for (const a of nodes) {
      const pa = positions.get(a);
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
      pa.vx = (pa.vx + fx) * 0.85;
      pa.vy = (pa.vy + fy) * 0.85;
    }
    for (const { from, to } of edges) {
      const pa = positions.get(from), pb = positions.get(to);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - linkDistance) * linkStrength;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      pa.vx += fx; pa.vy += fy;
      pb.vx -= fx; pb.vy -= fy;
    }
    for (const n of nodes) {
      const p = positions.get(n);
      p.x += p.vx; p.y += p.vy;
      p.x = Math.max(30, Math.min(width - 30, p.x));
      p.y = Math.max(30, Math.min(height - 30, p.y));
    }
  }
  return positions;
}

function titleOf(path) {
  return path.split("/").pop().replace(/\.md$/, "");
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

export default function VaultGraph({ demo = false }) {
  const [connected, setConnected] = useState(demo ? true : null);
  const [connection, setConnection] = useState(null);
  const [graph, setGraph] = useState(demo ? DEMO_GRAPH : null);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);
  const [openNote, setOpenNote] = useState(null);
  const [physics, setPhysics] = useState(loadPhysics);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const positionsRef = useRef(null);

  const updatePhysics = (next) => {
    setPhysics(next);
    savePhysics(next);
  };

  useEffect(() => {
    if (demo) return;
    (async () => {
      const conn = await loadVaultConnection();
      const isConnected = isVaultConnected(conn);
      setConnected(isConnected);
      if (!isConnected) return;
      setConnection(conn);
      try {
        const result = await auditVaultNotes(conn);
        setGraph(result);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [demo]);

  useEffect(() => {
    if (!graph || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const nodeSet = new Set(Object.keys(graph.tags || {}));
    for (const l of graph.links || []) { nodeSet.add(l.from); nodeSet.add(l.to); }
    for (const l of graph.suggested_links || []) { nodeSet.add(l.a); nodeSet.add(l.b); }
    const nodes = [...nodeSet];
    if (nodes.length === 0) return;

    const positions = runForceLayout(nodes, graph.links || [], width, height, physics);
    positionsRef.current = positions;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(document.documentElement);
      const border = `hsl(${style.getPropertyValue("--border")})`;
      const teal = `hsl(${style.getPropertyValue("--primary")})`;
      const fg = `hsl(${style.getPropertyValue("--foreground")})`;

      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (const { from, to } of graph.links || []) {
        const a = positions.get(from), b = positions.get(to);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = teal;
      ctx.setLineDash([4, 4]);
      for (const { a: fromPath, b: toPath } of graph.suggested_links || []) {
        const a = positions.get(fromPath), b = positions.get(toPath);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (const n of nodes) {
        const p = positions.get(n);
        const tag = physics.groupByTag ? (graph.tags?.[n] || [])[0] : null;
        const nodeColor = hovered === n ? teal : tag ? `hsl(${tagHue(tag)}, 55%, 55%)` : fg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hovered === n ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = fg;
        ctx.textAlign = "center";
        ctx.fillText(titleOf(n), p.x, p.y - 10);
      }
    };
    draw();
  }, [graph, hovered, physics]);

  const nodeAt = (e) => {
    if (!positionsRef.current || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let closest = null, closestDist = 14;
    for (const [n, p] of positionsRef.current) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < closestDist) { closest = n; closestDist = dist; }
    }
    return closest;
  };

  const handleMouseMove = (e) => {
    if (demo) return;
    setHovered(nodeAt(e));
  };

  // Demo mode never opens a note — nothing real to read for an invented
  // sample graph, same "hover/persistence disabled" boundary the rest of
  // this component already draws for marketing use.
  const handleClick = (e) => {
    if (demo) return;
    const node = nodeAt(e);
    if (node) setOpenNote(node);
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden relative" ref={containerRef}>
      {!demo && graph && (graph.links?.length || graph.suggested_links?.length) ? (
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
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-4 max-w-2xl mx-auto">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      ) : !graph ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground py-6 max-w-2xl mx-auto">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading your vault…
        </div>
      ) : (graph.links || []).length === 0 && (graph.suggested_links || []).length === 0 ? (
        <div className="max-w-2xl mx-auto pt-4">
          <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
            <p className="text-sm font-medium">No connections yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add some [[wikilinks]] between your notes and this page fills in automatically.
            </p>
          </div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          className={`w-full h-full ${!demo && hovered ? "cursor-pointer" : "cursor-default"}`}
        />
      )}

      {openNote && connection && (
        <NoteContentModal path={openNote} connection={connection} onClose={() => setOpenNote(null)} />
      )}
    </div>
  );
}
