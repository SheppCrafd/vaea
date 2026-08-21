import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { loadGoogleWorkspaceConnection, saveGoogleWorkspaceConnection, isGoogleWorkspaceConnected } from "@/lib/googleWorkspaceConnection";
import { listEvents as listGoogleEvents } from "@/lib/googleCalendarApi";
import { loadMicrosoftConnection, saveMicrosoftConnection, isMicrosoftConnected } from "@/lib/microsoftConnection";
import { listEvents as listMicrosoftEvents } from "@/lib/microsoftGraphApi";
import { useProjects } from "@/hooks/useProjects";
import { getProjectDueDate, getProjectDueStatus } from "@/lib/projectUtils";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import CalendarView from "@/components/calendar/CalendarView";

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
        <CalendarView view={view} loading={loading} anyConnected={anyConnected} error={error} groups={groups} />
      </div>
    </div>
  );
}
