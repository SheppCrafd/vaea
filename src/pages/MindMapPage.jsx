import { useEffect, useRef, useState } from "react";
import { Network, Loader2, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { auditVaultNotes } from "@/lib/githubApi";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";

// Real rendering, built on Phase 2's vault auto-linking work: auditVaultNotes
// already returns every resolved [[wikilink]] (links) plus suggested_links
// (topically-related notes with no link yet — dashed here, since they're a
// suggestion, not a fact). A small self-contained force simulation (no
// external graph library — this app has no other charting dependency to
// justify pulling one in for a single page) settles node positions, drawn on
// canvas per this app's usual "generative graphics belong on canvas, not
// hand-authored SVG" rule.
const MAX_ITERATIONS = 300;
const REPULSION = 2400;
const SPRING_LENGTH = 90;
const SPRING_STRENGTH = 0.02;
const DAMPING = 0.85;

function runForceLayout(nodes, edges, width, height) {
  const positions = new Map(nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = Math.min(width, height) / 3;
    return [n, { x: width / 2 + Math.cos(angle) * r, y: height / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }];
  }));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    for (const a of nodes) {
      const pa = positions.get(a);
      let fx = 0, fy = 0;
      for (const b of nodes) {
        if (a === b) continue;
        const pb = positions.get(b);
        const dx = pa.x - pb.x, dy = pa.y - pb.y;
        const distSq = Math.max(dx * dx + dy * dy, 1);
        const force = REPULSION / distSq;
        fx += (dx / Math.sqrt(distSq)) * force;
        fy += (dy / Math.sqrt(distSq)) * force;
      }
      pa.vx = (pa.vx + fx) * DAMPING;
      pa.vy = (pa.vy + fy) * DAMPING;
    }
    for (const { from, to } of edges) {
      const pa = positions.get(from), pb = positions.get(to);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
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

export default function MindMapPage() {
  const [connected, setConnected] = useState(null);
  const [graph, setGraph] = useState(null); // { nodes, links, suggested_links }
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const positionsRef = useRef(null);

  useEffect(() => {
    (async () => {
      const connection = await loadVaultConnection();
      const isConnected = isVaultConnected(connection);
      setConnected(isConnected);
      if (!isConnected) return;
      try {
        const result = await auditVaultNotes(connection);
        setGraph(result);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!graph || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // graph.notes_scanned only gives a count — rebuild the actual node list
    // from every path mentioned across links/suggested_links/tags, since
    // auditVaultNotes doesn't separately return the scanned path list.
    const nodeSet = new Set(Object.keys(graph.tags || {}));
    for (const l of graph.links || []) { nodeSet.add(l.from); nodeSet.add(l.to); }
    for (const l of graph.suggested_links || []) { nodeSet.add(l.a); nodeSet.add(l.b); }
    const nodes = [...nodeSet];
    if (nodes.length === 0) return;

    const positions = runForceLayout(nodes, graph.links || [], width, height);
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, hovered === n ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = hovered === n ? teal : fg;
        ctx.fill();
        ctx.font = "11px Inter, sans-serif";
        ctx.fillStyle = fg;
        ctx.textAlign = "center";
        ctx.fillText(titleOf(n), p.x, p.y - 10);
      }
    };
    draw();
  }, [graph, hovered]);

  const handleMouseMove = (e) => {
    if (!positionsRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let closest = null, closestDist = 14;
    for (const [n, p] of positionsRef.current) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < closestDist) { closest = n; closestDist = dist; }
    }
    setHovered(closest);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader Icon={Network} title="Mind Map" subtitle="A visual map of how your vault notes connect" />
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4" ref={containerRef}>
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
          <canvas ref={canvasRef} onMouseMove={handleMouseMove} className="w-full h-full cursor-default" />
        )}
      </div>
    </div>
  );
}
