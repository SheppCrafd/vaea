import { useEffect, useState } from "react";
import { CalendarDays, Video, Loader2, TriangleAlert } from "lucide-react";
import { loadGoogleWorkspaceConnection, saveGoogleWorkspaceConnection, isGoogleWorkspaceConnected } from "@/lib/googleWorkspaceConnection";
import { listEvents as listGoogleEvents } from "@/lib/googleCalendarApi";
import { loadMicrosoftConnection, saveMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { listEvents as listMicrosoftEvents } from "@/lib/microsoftGraphApi";
import { useProjects } from "@/hooks/useProjects";
import { getProjectDueDate, getProjectDueStatus } from "@/lib/projectUtils";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";

// Vaea Calendar — a native page (not a wrapper around one connector) that
// auto-aggregates every connected, time/date-relevant source: Google
// Workspace Calendar, Microsoft 365 Calendar, and Vaea's own committed
// project due dates, merged into one agenda. Phase 1 is read-only; the rest
// of the Scheduling & Time backlog (auto-scheduling, dynamic reschedule,
// protected focus blocks, habit scheduling, booking links, a real week/month
// grid) lands in Phase 3 once this aggregation layer is proven out. Editing
// via Vaea Chat already works today through the existing calendar tool
// catalog (CREATE_CALENDAR_EVENT etc.) — this page is the read surface for
// the same data, not a second source of truth.
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function groupByDay(items) {
  const groups = new Map();
  for (const item of items) {
    const key = dayKey(item.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function WeekView({ groups }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: d.toISOString().slice(0, 10), date: d };
  });
  const byKey = new Map(groups);
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(({ key, date }) => (
        <div key={key} className="card-enter bg-card border border-foreground/[0.04] rounded-xl shadow-md p-2.5 min-h-[140px]">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            {date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
          </p>
          <div className="flex flex-col gap-1">
            {(byKey.get(key) || []).map((item) => (
              <p key={item.id} className="text-[11px] leading-tight truncate" title={item.title}>
                {item.title}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VaeaCalendarPage() {
  const [view, setView] = useState("agenda");
  const [google, setGoogle] = useState(null);
  const [microsoft, setMicrosoft] = useState(null);
  const [googleEvents, setGoogleEvents] = useState(null);
  const [microsoftEvents, setMicrosoftEvents] = useState(null);
  const [error, setError] = useState("");
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    (async () => {
      const [g, m] = await Promise.all([loadGoogleWorkspaceConnection(), loadMicrosoftConnection()]);
      setGoogle(g);
      setMicrosoft(m);

      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      if (isGoogleWorkspaceConnected(g)) {
        try {
          const { events, connection } = await listGoogleEvents(g, { timeMin, timeMax, maxResults: 50 });
          setGoogleEvents(events);
          if (connection.accessToken !== g.accessToken) await saveGoogleWorkspaceConnection(connection);
        } catch (err) {
          setError(err.message);
          setGoogleEvents([]);
        }
      } else {
        setGoogleEvents([]);
      }

      if (isMicrosoftConnected(m)) {
        try {
          const { events, connection } = await listMicrosoftEvents(m, { timeMin, timeMax, maxResults: 50 });
          setMicrosoftEvents(events);
          if (connection.accessToken !== m.accessToken) await saveMicrosoftConnection(connection);
        } catch (err) {
          setError((prev) => prev || err.message);
          setMicrosoftEvents([]);
        }
      } else {
        setMicrosoftEvents([]);
      }
    })();
  }, []);

  const loading = googleEvents === null || microsoftEvents === null;
  const anyConnected = isGoogleWorkspaceConnected(google) || isMicrosoftConnected(microsoft);

  const items = loading
    ? []
    : [
        ...(googleEvents || []).map((e) => ({
          id: `google-${e.id}`,
          date: new Date(e.start?.dateTime || e.start?.date),
          title: e.summary || "(no title)",
          source: "Google Calendar",
          meetLink: e.hangoutLink,
        })),
        ...(microsoftEvents || []).map((e) => ({
          id: `microsoft-${e.id}`,
          date: new Date(e.start),
          title: e.subject || "(no title)",
          source: "Outlook",
          meetLink: e.isOnlineMeeting ? e.onlineMeetingUrl : null,
        })),
        ...projects
          .filter((p) => getProjectDueStatus(p) === "COMMITTED" && getProjectDueDate(p))
          .map((p) => ({
            id: `project-${p.id}`,
            date: new Date(getProjectDueDate(p)),
            title: `${p.title} due`,
            source: "Vaea project",
          })),
      ]
        .filter((item) => !Number.isNaN(item.date.getTime()))
        .sort((a, b) => a.date - b.date);

  const groups = groupByDay(items);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={CalendarDays}
        title="Vaea Calendar"
        subtitle="Every connected calendar, plus committed project due dates, in one place"
        action={
          <div className="inline-flex items-center rounded-full bg-card/70 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05)] p-1 text-xs font-medium">
            <button
              onClick={() => setView("agenda")}
              aria-pressed={view === "agenda"}
              className={`px-3 py-1 rounded-full transition-colors ${view === "agenda" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Agenda
            </button>
            <button
              onClick={() => setView("week")}
              aria-pressed={view === "week"}
              className={`px-3 py-1 rounded-full transition-colors ${view === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Week
            </button>
          </div>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        <div className={view === "week" ? "pt-4" : "max-w-2xl mx-auto pt-4"}>
          {loading ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your calendar…
            </div>
          ) : !anyConnected ? (
            <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
              <CalendarDays className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No calendar connected yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect Google Workspace or Microsoft 365 in Settings and this page fills in automatically —
                nothing else to configure here.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <p className="flex items-start gap-1.5 text-xs text-destructive mb-4">
                  <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
                </p>
              )}
              {view === "week" ? (
                <WeekView groups={groups} />
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing coming up in the next 30 days.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {groups.map(([key, dayItems]) => (
                    <div key={key} className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        {new Date(key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                      </p>
                      <div className="flex flex-col divide-y divide-border">
                        {dayItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                            <span className="text-xs text-muted-foreground font-terminal shrink-0 w-16">
                              {item.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
                            {item.meetLink && <Video className="w-3.5 h-3.5 text-primary shrink-0" />}
                            <span className="text-[10px] text-muted-foreground shrink-0">{item.source}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
