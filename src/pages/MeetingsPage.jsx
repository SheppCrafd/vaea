import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import ReactMarkdown from "react-markdown";
import { sanitizeUrl } from "@/lib/sanitizeUrl";
import { NotebookPen, Loader2, TriangleAlert, Search, Settings as SettingsIcon, ArrowLeft, ExternalLink, ListChecks, Sparkles, Link2, Check, FileText } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import { loadGranolaConnection, saveGranolaConnection, isGranolaConnected, isFreeGranolaPlan } from "@/lib/granolaConnection";
import { callTool, resultText } from "@/lib/granolaMcp";
import { parseMeetings, plainText, formatMeetingDate } from "@/lib/granolaMeetings";
import { useProjects, useUpdateProject } from "@/hooks/useProjects";

// Granola's own time ranges (list_meetings `time_range`).
const RANGES = [
  { key: "last_7_days", label: "Last 7 days" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "last_30_days", label: "Last 30 days" },
];

// Only an https link from Granola is opened or saved onto a project.
const isHttps = (url) => typeof url === "string" && url.startsWith("https://");

// Runs one Granola tool and saves the connection if its token was refreshed.
async function granola(connection, setConnection, name, args) {
  const { result, connection: next } = await callTool(connection, name, args);
  if (next.accessToken !== connection.accessToken) {
    setConnection(next);
    await saveGranolaConnection(next);
  }
  return resultText(result);
}

// The meeting as plain text for Vaea Chat: what a person would paste.
function meetingBrief(meeting, raw) {
  const lines = [`Meeting: ${meeting.title}`];
  if (meeting.date) lines.push(`When: ${formatMeetingDate(meeting.date)}`);
  if (meeting.people.length) lines.push(`Attendees: ${meeting.people.join(", ")}`);
  if (meeting.url) lines.push(`Granola note: ${meeting.url}`);
  const body = [meeting.summary && `Summary:\n${meeting.summary}`, meeting.privateNotes && `My notes:\n${meeting.privateNotes}`].filter(Boolean).join("\n\n");
  return `${lines.join("\n")}\n\n${body || plainText(raw)}`;
}

function NotConnected() {
  return (
    <div className="max-w-2xl mx-auto pt-4 px-4">
      <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
        <NotebookPen className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">Granola isn't connected</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Connect Granola in Settings and your meeting notes show up here, ready to turn into tasks.
        </p>
        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1.5 text-sm mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
        >
          <SettingsIcon className="w-3.5 h-3.5" /> Go to Settings
        </Link>
      </div>
    </div>
  );
}

function MeetingRow({ meeting, active, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active || undefined}
        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-accent" : "hover:bg-accent/60"}`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium truncate">{meeting.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{formatMeetingDate(meeting.date)}</span>
        </span>
        {meeting.people.length > 0 && (
          <span className="block text-xs text-muted-foreground truncate mt-0.5">{meeting.people.join(", ")}</span>
        )}
      </button>
    </li>
  );
}

function MeetingDetail({ meeting, raw, loading, error, plan, onBack, onTranscript, transcript, projects, onLink, linkedTo }) {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const project = projects.find((p) => p.id === projectId);
  const brief = meeting ? meetingBrief(meeting, raw) : "";
  const granolaUrl = isHttps(meeting?.url) ? meeting.url : "";

  // The chat box is one line and drops line breaks, which would run
  // "Decisions" into "- Launch moves…". Mark each break with " / " instead.
  const toChat = (instruction) =>
    navigate("/app/chat", {
      state: { initialMessage: `${instruction} Meeting notes: """${brief.split(/\s*\n+\s*/).filter(Boolean).join(" / ")}"""` },
    });

  const turnIntoTasks = () =>
    toChat(
      project
        ? `Turn this meeting's action items into tasks in the project "${project.title}". One task per action item, with the owner and due date when the notes say them.`
        : "Turn this meeting's action items into tasks. One task per action item, with the owner and due date when the notes say them, and propose which project each belongs to."
    );
  const process = () =>
    toChat("Process this meeting. Pull out the tasks, decisions, open questions and follow-ups, and propose where each should go.");

  return (
    <div className="h-full overflow-auto px-4 sm:px-6 pb-8">
      <button type="button" onClick={onBack} className="md:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-3">
        <ArrowLeft className="w-3.5 h-3.5" /> All meetings
      </button>
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-16 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening the meeting…
        </div>
      ) : error ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-6"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}</p>
      ) : meeting ? (
        <article className="max-w-2xl pt-4 md:pt-6">
          <h2 className="text-lg font-semibold leading-snug">{meeting.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {[formatMeetingDate(meeting.date), meeting.people.join(", ")].filter(Boolean).join(" · ")}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button type="button" onClick={turnIntoTasks} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm">
              <ListChecks className="w-3.5 h-3.5" /> Turn Into Tasks
            </button>
            <button type="button" onClick={process} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Have Vaea Process
            </button>
            {granolaUrl && (
              <a href={granolaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Open in Granola
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label htmlFor="meeting-project" className="text-xs text-muted-foreground">Project</label>
            <select
              id="meeting-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="text-sm bg-background border border-input rounded-md px-2 py-1.5 max-w-[16rem]"
            >
              <option value="">Choose a project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button
              type="button"
              disabled={!project || !granolaUrl || linkedTo === projectId}
              onClick={() => onLink(project, meeting)}
              title={!granolaUrl ? "Granola didn't send a link for this meeting" : undefined}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              {linkedTo === projectId && projectId ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              {linkedTo === projectId && projectId ? "Linked" : "Link to Project"}
            </button>
          </div>

          <section className="mt-6">
            {meeting.summary ? (
              <div className="text-sm leading-relaxed text-foreground [&_p]:mb-3 [&_p:last-child]:mb-0 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mb-1.5 [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
                <ReactMarkdown urlTransform={sanitizeUrl}>{meeting.summary}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{plainText(raw)}</p>
            )}
            {meeting.privateNotes && (
              <>
                <h3 className="text-sm font-medium mt-6 mb-2">Your notes</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{meeting.privateNotes}</p>
              </>
            )}
          </section>

          {!isFreeGranolaPlan(plan) && (
            <section className="mt-6 pt-4 border-t border-border">
              {transcript.text ? (
                <>
                  <h3 className="text-sm font-medium mb-2">Transcript</h3>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{transcript.text}</p>
                </>
              ) : (
                <button type="button" onClick={onTranscript} disabled={transcript.loading} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50">
                  {transcript.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  {transcript.loading ? "Loading transcript…" : "Show Transcript"}
                </button>
              )}
              {transcript.error && <p className="flex items-start gap-1.5 text-xs text-destructive mt-2"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {transcript.error}</p>}
            </section>
          )}
        </article>
      ) : (
        <p className="hidden md:block text-sm text-muted-foreground text-center pt-24">Choose a meeting to see its notes.</p>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const [connection, setConnection] = useState(null);
  const [range, setRange] = useState("last_7_days");
  const [filter, setFilter] = useState("");
  const [list, setList] = useState({ loading: true, error: "", meetings: [], raw: "" });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({ loading: false, error: "", meeting: null, raw: "" });
  const [transcript, setTranscript] = useState({ loading: false, error: "", text: "" });
  const [linkedTo, setLinkedTo] = useState("");
  const { data: projects = [] } = useProjects();
  const updateProject = useUpdateProject();

  useEffect(() => {
    loadGranolaConnection().then(setConnection);
  }, []);
  const connected = isGranolaConnected(connection);

  const loadList = async () => {
    setList((s) => ({ ...s, loading: true, error: "" }));
    try {
      const text = await granola(connection, setConnection, "list_meetings", { time_range: range, max_participants: 10 });
      const { meetings, raw } = parseMeetings(text);
      setList({ loading: false, error: "", meetings, raw });
    } catch (err) {
      setList({ loading: false, error: err.message, meetings: [], raw: "" });
    }
  };

  useEffect(() => {
    if (connected) loadList();
    // Reload when the range changes or the connection first loads; a token
    // refresh mid-session must not trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, range]);

  const open = async (meeting) => {
    setOpenId(meeting.id);
    setLinkedTo("");
    setTranscript({ loading: false, error: "", text: "" });
    setDetail({ loading: true, error: "", meeting: null, raw: "" });
    try {
      const text = await granola(connection, setConnection, "get_meetings", { meeting_ids: [meeting.id], max_participants: 20, attachments: "none" });
      const parsed = parseMeetings(text).meetings.find((m) => m.id === meeting.id) || parseMeetings(text).meetings[0];
      // Keep what the list already knew when the detail leaves it out.
      const merged = parsed ? { ...meeting, ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => (Array.isArray(v) ? v.length : v))) } : meeting;
      setDetail({ loading: false, error: "", meeting: merged, raw: text });
    } catch (err) {
      setDetail({ loading: false, error: err.message, meeting: null, raw: "" });
    }
  };

  const loadTranscript = async () => {
    setTranscript({ loading: true, error: "", text: "" });
    try {
      const text = await granola(connection, setConnection, "get_meeting_transcript", { meeting_id: openId, max_chars: 40000 });
      setTranscript({ loading: false, error: "", text: plainText(text) });
    } catch (err) {
      // Granola's own words, e.g. when the plan doesn't include transcripts.
      setTranscript({ loading: false, error: err.message, text: "" });
    }
  };

  const linkToProject = async (project, meeting) => {
    if (!isHttps(meeting.url)) return;
    const links = project.links || [];
    if (!links.some((l) => l.url === meeting.url)) {
      await updateProject.mutateAsync({ id: project.id, data: { links: [...links, { label: `Granola: ${meeting.title}`, url: meeting.url }] } });
    }
    setLinkedTo(project.id);
  };

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list.meetings;
    return list.meetings.filter((m) => `${m.title} ${m.people.join(" ")}`.toLowerCase().includes(q));
  }, [filter, list.meetings]);

  const liveProjects = projects.filter((p) => !p.is_archived);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={NotebookPen}
        title="Meetings"
        subtitle="Your Granola meeting notes"
        action={
          connected && (
            <button
              onClick={loadList}
              disabled={list.loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              {list.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {list.loading ? "Refreshing…" : "Refresh"}
            </button>
          )
        }
      />

      {connection === null ? null : !connected ? (
        <NotConnected />
      ) : (
        <>
          <div className="px-4 flex items-center gap-3 border-b border-border">
            <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Time range">
              {RANGES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  aria-pressed={range === key}
                  className={`shrink-0 text-sm px-2.5 sm:px-3 py-2 border-b-2 -mb-px transition-colors ${range === key ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <label className="shrink-0 py-2 hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title or person"
                className="bg-transparent outline-none w-40 sm:w-48 text-foreground placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <div className="flex-1 min-h-0 flex">
            <div className={`${openId ? "hidden md:block" : "block"} w-full md:w-80 lg:w-96 shrink-0 md:border-r border-border overflow-auto p-2`}>
              {list.loading && list.meetings.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-8 justify-center">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading meetings…
                </div>
              ) : list.error ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive p-2"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {list.error}</p>
              ) : shown.length > 0 ? (
                <ul className="flex flex-col gap-0.5">
                  {shown.map((m) => <MeetingRow key={m.id} meeting={m} active={m.id === openId} onOpen={() => open(m)} />)}
                </ul>
              ) : list.raw && list.meetings.length === 0 ? (
                // Granola answered with text Vaea couldn't read as meetings
                // (often "no meetings in this range"): show it as sent.
                <p className="text-sm text-muted-foreground whitespace-pre-wrap p-2">{plainText(list.raw)}</p>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16 px-4">
                  {filter ? "No meetings match that filter." : "No meetings in this range. Try a longer one."}
                </p>
              )}
            </div>
            <div className={`${openId ? "block" : "hidden md:block"} flex-1 min-w-0`}>
              <MeetingDetail
                meeting={detail.meeting}
                raw={detail.raw}
                loading={detail.loading}
                error={detail.error}
                plan={connection.plan}
                onBack={() => setOpenId(null)}
                onTranscript={loadTranscript}
                transcript={transcript}
                projects={liveProjects}
                onLink={linkToProject}
                linkedTo={linkedTo}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
