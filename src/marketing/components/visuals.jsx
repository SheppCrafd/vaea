import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import TerminalBlock from "@/components/settings/TerminalBlock";
import { useReveal, prefersReducedMotion } from "../useReveal";
import { CHAT_MESSAGES, VMAIL_MESSAGES, CALENDAR_GROUPS } from "../fixtures";

// The demos render the REAL app components with fixture data. They're
// lazy-loaded and only mounted once their block scrolls into view, so:
//  - an anonymous marketing visitor never downloads the chat/markdown/base44
//    code unless they scroll to a demo that needs it;
//  - the build-time prerender never evaluates those modules at all.
const ChatMessageList = lazy(() => import("@/components/ai/ChatMessageList"));
const InboxFrame = lazy(() => import("@/components/vmail/InboxFrame"));
const CalendarView = lazy(() => import("@/components/calendar/CalendarView"));
const VaultGraph = lazy(() => import("@/components/mindmap/VaultGraph"));

const noop = () => {};

// Inert wrapper: aria-hidden, pointer-events-none (pointer stays a default
// arrow, nothing is clickable), select-none. Component-internal animation
// (the chat typewriter, the notes-map motion) still runs.
export function DemoStage({ label, className, onDark = false, children }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "mkt-demo pointer-events-none select-none overflow-hidden rounded-2xl border shadow-[0_1px_3px_0_hsl(200_30%_12%/0.1),0_36px_72px_-34px_hsl(200_30%_12%/0.34)]",
        // On a light section: a frosted, translucent card. On a dark
        // section (tone="dark" ShowBlock) that same treatment turns milky
        // grey, so switch to a crisp opaque white card instead.
        onDark ? "border-black/5 bg-card" : "border-foreground/[0.08] bg-card/70 backdrop-blur-xl",
        className,
      )}
    >
      {label && (
        <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--signal-rgb))]" />
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// Reserves height, then swaps in the lazy component once the block is in
// view. Prerender / first paint just shows the empty reserved box.
function Deferred({ height = 320, children }) {
  const [ref, shown] = useReveal();
  return (
    <div ref={ref} style={{ minHeight: height }} className="flex flex-col">
      {shown ? <Suspense fallback={<div className="flex-1" />}>{children}</Suspense> : <div className="flex-1" />}
    </div>
  );
}

// Loops: the reply re-types every ~9s. The stage height is fixed and the
// message list scrolls internally, so nothing outside it resizes as the
// text fills in or resets.
export function ChatDemo({ onDark = false }) {
  const [ref, shown] = useReveal();
  const [cycle, setCycle] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!shown || reduced) return;
    const id = setInterval(() => setCycle((c) => c + 1), 9000);
    return () => clearInterval(id);
  }, [shown, reduced]);

  return (
    <DemoStage label="Vaea Chat" onDark={onDark}>
      <div ref={ref} className="flex h-[420px] flex-col">
        {shown ? (
          <Suspense fallback={<div className="flex-1" />}>
            <ChatMessageList
              key={cycle}
              messages={CHAT_MESSAGES}
              isComputing={false}
              isPlanning={false}
              liveSteps={[]}
              streamingText=""
              iconChoice="terminal"
              hasMore={false}
              onLoadMore={noop}
              resolvingId={null}
              onConfirm={noop}
              onCancel={noop}
              newMessageIds={reduced ? new Set() : new Set(["a1"])}
              onMessageTyped={noop}
            />
          </Suspense>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </DemoStage>
  );
}

export function VmailDemo() {
  return (
    <DemoStage>
      <Deferred height={320}>
        <div className="flex flex-1 flex-col pt-1">
          <InboxFrame demo folder="inbox" onFolderChange={noop} anyConnected messages={VMAIL_MESSAGES} />
        </div>
      </Deferred>
    </DemoStage>
  );
}

export function CalendarDemo() {
  return (
    <DemoStage label="One calendar">
      <Deferred height={340}>
        <div className="overflow-hidden p-4">
          <CalendarView demo groups={CALENDAR_GROUPS} anyConnected />
        </div>
      </Deferred>
    </DemoStage>
  );
}

// `interactive` (the /brain hero) renders a real, movable graph — pan, zoom,
// drag a node — in a plain fixed-height frame, not the inert DemoStage. The
// lazy VaultGraph still mounts only once the frame scrolls into view, so the
// prerender/first paint just shows the empty reserved box. Everywhere else
// it's the passive, looping notes-map demo.
export function MindMapDemo({ interactive = false }) {
  const [ref, shown] = useReveal();
  if (interactive) {
    return (
      <div>
        <div className="h-[440px] overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/70 shadow-[0_1px_3px_0_hsl(200_30%_12%/0.1),0_36px_72px_-34px_hsl(200_30%_12%/0.34)] backdrop-blur-xl">
          <div ref={ref} className="flex h-full flex-col">
            {shown ? (
              <Suspense fallback={<div className="flex-1" />}>
                <VaultGraph demo interactive />
              </Suspense>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </div>
        <p className="mt-2 text-center font-mono text-[0.68rem] tracking-tight text-muted-foreground">
          drag a note · scroll to zoom · this one you can actually move
        </p>
      </div>
    );
  }
  return (
    <DemoStage label="Notes map">
      <Deferred height={320}>
        <VaultGraph demo />
      </Deferred>
    </DemoStage>
  );
}

// Real TerminalBlock with a working copy button — a real command to run is
// worth copying, so these are NOT wrapped in the inert demo treatment. Light
// enough to keep static (no window at module or render scope), so it renders
// straight into the prerendered HTML.
export function StorageTerminal() {
  return (
    <TerminalBlock
      title="your-folder"
      showPrompt
      code={["ls", "# areas.json   projects.json   tasks.json", "# people.json   notes.json", "", "# times your work was sent anywhere: 0"].join("\n")}
    />
  );
}

export function LocalModeTerminal() {
  return (
    <TerminalBlock
      title="on your computer"
      showPrompt
      code={["# Vaea Chat runs against a model on this machine", "ask  ->  answer      (no internet)", "", "# requests leaving your computer: 0"].join("\n")}
    />
  );
}

// The self-hosting relay path: Vaea on localhost, Local Mode on, Claude Code
// answering Vaea Chat as the model from inside the checked-out repo.
export function ClaudeCodeTerminal() {
  return (
    <TerminalBlock
      title="~/vaea"
      showPrompt
      code={[
        "git clone https://github.com/SheppCrafd/vaea && cd vaea",
        "npm install && npm run dev        # Vaea on localhost",
        "",
        "# Settings -> AI Model -> Local Mode -> connect a folder",
        "claude          # in the repo, pointed at that folder",
        "/local-relay    # answer one pending Vaea Chat message  (or: /l)",
        "",
        "# requests leaving your network: 0",
      ].join("\n")}
    />
  );
}

// A count-up that lands with its section — the one small reward on an
// otherwise still page. tabular-nums so it never reflows.
export function CountUp({ to, suffix = "", className }) {
  const [ref, shown] = useReveal();
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!shown) return;
    const start = performance.now();
    const dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [shown, to]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {n}
      {suffix}
    </span>
  );
}
