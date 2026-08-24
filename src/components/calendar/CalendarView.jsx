import { Video, Loader2, TriangleAlert, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

// The real Vaea Calendar agenda/week rendering, split out of
// VaeaCalendarPage.jsx so the marketing page can render this exact
// component (via `demo`) instead of a hand-built recreation. Purely
// presentational — takes already-computed `groups` (day-key -> items[],
// same shape groupByDay() in VaeaCalendarPage.jsx produces), no data
// fetching of its own.
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

export default function CalendarView({
  view = "agenda",
  loading = false,
  anyConnected = true,
  error = "",
  groups = [],
  demo = false,
}) {
  return (
    <div className={demo ? "" : view === "week" ? "pt-4" : "max-w-2xl mx-auto pt-4"}>
      {loading ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your calendar…
        </div>
      ) : !anyConnected && groups.length === 0 ? (
        <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
          <CalendarDays className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No calendar connected yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect Google Workspace or Microsoft 365 in Settings and this page fills in automatically —
            nothing else to configure here.
          </p>
          {!demo && (
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1.5 text-sm mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              Go to Settings
            </Link>
          )}
        </div>
      ) : (
        <>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive mb-4">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
          {!anyConnected && groups.length > 0 && (
            <p className="text-xs text-muted-foreground mb-4">
              No calendar connected yet — showing your committed project due dates only.{" "}
              {!demo && (
                <Link to="/app/settings" className="underline underline-offset-2 hover:text-foreground">
                  Connect Google Workspace or Microsoft 365
                </Link>
              )}
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
  );
}
