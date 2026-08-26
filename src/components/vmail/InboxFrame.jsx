import { Link } from "react-router-dom";
import { Inbox, Send, Archive, ShieldAlert, Trash2, ArchiveRestore, Loader2, TriangleAlert, Search, Settings as SettingsIcon } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";

// The real Vmail folder-nav + search bar + message list, split out of
// VmailPage.jsx so the marketing page can render this exact component
// (via `demo`) instead of a hand-built recreation. Real mode gets real
// props (live messages, real action dispatch) from VmailPage.jsx; demo
// mode gets fixed sample data and never calls onMessageAction — a visitor
// can still click between folders (harmless, not misleading, same pattern
// Mind Map's own demo already uses), but per-message actions and search
// are inert rather than pretending to work.
export const FOLDERS = [
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "sent", label: "Sent", Icon: Send },
  { key: "archive", label: "Archive", Icon: Archive },
  { key: "junk", label: "Junk", Icon: ShieldAlert },
  { key: "trash", label: "Trash", Icon: Trash2 },
];

function relativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function InboxFrame({
  folder,
  onFolderChange,
  searchInput = "",
  onSearchInputChange,
  onSearchSubmit,
  anyConnected = true,
  errors = [],
  appleConnected = false,
  loading = false,
  messages = [],
  busyId = null,
  onMessageAction,
  demo = false,
}) {
  return (
    <>
      <div className="px-4 flex items-center gap-3 border-b border-border">
        {/* min-w-0 + overflow-x-auto so the five folders stay reachable by
            swipe on a phone instead of the last one clipping under the
            fixed-width search field. */}
        <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {FOLDERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => onFolderChange(key)}
              className={`shrink-0 flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-2 border-b-2 -mb-px transition-colors ${folder === key ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>
        {/* Hidden below sm: the five folder tabs plus a text field don't
            coexist on a phone row. The tabs win; search returns at sm+. */}
        <form
          onSubmit={(e) => { e.preventDefault(); onSearchSubmit?.(e); }}
          className="shrink-0 py-2 hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => onSearchInputChange?.(e.target.value)}
            placeholder="Search this folder"
            readOnly={demo}
            className="bg-transparent outline-none w-28 sm:w-40 text-foreground placeholder:text-muted-foreground"
          />
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-6">
        {!anyConnected && !loading ? (
          // Same card treatment as the other "connect a service" pages
          // (Calendar, Meetings, Mind Map) — a top-aligned bg-card panel,
          // not a viewport-centered bare stack, so all four read alike.
          <div className="max-w-2xl mx-auto pt-4">
            <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
              <Inbox className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Nothing connected yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Connect Gmail, Outlook, or Apple Mail in Settings and your inbox shows up here.
              </p>
              {!demo && (
                <Link
                  to="/app/settings"
                  className="inline-flex items-center gap-1.5 text-sm mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
                >
                  <SettingsIcon className="w-3.5 h-3.5" /> Go to Settings
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            {errors.map((e) => (
              <p key={e} className="flex items-start gap-1.5 text-xs text-destructive mt-4">
                <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {e}
              </p>
            ))}
            {appleConnected && (
              <p className="text-xs text-muted-foreground bg-card border border-foreground/[0.04] rounded-xl px-4 py-3 mt-4">
                Apple Mail is connected — message sync for it is still being built, so its messages aren't in the list below yet.
              </p>
            )}
            {loading && messages.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-8 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Nothing here.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 mt-4">
                {messages.map((m) => (
                  <li
                    key={`${m.provider}-${m.id}`}
                    className="card-enter group flex items-center gap-3 bg-card border border-foreground/[0.04] rounded-xl px-4 py-3 shadow-sm"
                  >
                    {m.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 w-14">{m.label}</span>
                    <span className={`text-sm truncate shrink-0 w-40 ${m.unread ? "font-medium" : "text-muted-foreground"}`}>{m.from}</span>
                    <span className={`text-sm truncate flex-1 ${m.unread ? "font-medium" : ""}`}>{m.subject || "(no subject)"}</span>
                    <span className="text-xs text-muted-foreground font-terminal shrink-0">{relativeTime(m.date)}</span>
                    {!demo && (
                      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {busyId === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {folder !== "archive" && (
                              <button onClick={() => onMessageAction(m, "archive")} aria-label="Archive" title="Archive" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {folder !== "junk" && (
                              <button onClick={() => onMessageAction(m, "spam")} aria-label="Report spam" title="Report spam" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md">
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {folder !== "trash" ? (
                              <DeleteButton onClick={() => onMessageAction(m, "delete")} className="p-1.5 rounded-md" />
                            ) : (
                              <button onClick={() => onMessageAction(m, "restore")} aria-label="Restore" title="Restore" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md">
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
