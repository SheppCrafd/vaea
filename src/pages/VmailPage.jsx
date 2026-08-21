import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Send, Archive, ShieldAlert, Trash2, Loader2, TriangleAlert, Settings as SettingsIcon, Search, PenSquare, X, ArchiveRestore } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import { loadGmailConnection, saveGmailConnection, isGmailConnected } from "@/lib/gmailConnection";
import { listMessages as listGmailMessages, sendMessage as sendGmailMessage, archiveMessage as archiveGmailMessage, trashMessage as trashGmailMessage, untrashMessage as untrashGmailMessage, markSpam as markGmailSpam } from "@/lib/gmailApi";
import { loadOutlookConnection, saveOutlookConnection, isOutlookConnected } from "@/lib/outlookConnection";
import { listMessages as listOutlookMessages, sendMessage as sendOutlookMessage, archiveMessage as archiveOutlookMessage, deleteMessage as deleteOutlookMessage, restoreMessage as restoreOutlookMessage, markSpam as markOutlookSpam } from "@/lib/microsoftGraphApi";
import { loadAppleMailConnection, isAppleMailConnected } from "@/lib/appleMailConnection";

// Vmail: one native email client aggregating every connected account
// (Gmail, Outlook, Apple Mail) — folders, search, and compose, same as any
// real inbox — but every action here is a thin wrapper over the exact same
// provider calls the chat tools use (gmailApi.js/microsoftGraphApi.js), so
// what a person does by hand and what they ask the assistant to do act on
// the identical account, not two separate data paths. With nothing
// connected, folders/search/compose all still render — there's just
// nothing real for them to act on until Settings has an account.
const FOLDERS = [
  { key: "inbox", label: "Inbox", Icon: Inbox },
  { key: "sent", label: "Sent", Icon: Send },
  { key: "archive", label: "Archive", Icon: Archive },
  { key: "junk", label: "Junk", Icon: ShieldAlert },
  { key: "trash", label: "Trash", Icon: Trash2 },
];

function gmailQueryForFolder(folder, search) {
  const folderQuery = {
    inbox: "in:inbox",
    sent: "in:sent",
    archive: "-in:inbox -in:sent -in:trash -in:spam",
    junk: "in:spam",
    trash: "in:trash",
  }[folder];
  return [folderQuery, search].filter(Boolean).join(" ");
}

const OUTLOOK_FOLDER = { inbox: "inbox", sent: "sentitems", archive: "archive", junk: "junkemail", trash: "deleteditems" };

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

function ComposeModal({ accounts, onClose, onSent }) {
  const [from, setFrom] = useState(accounts[0]?.key || "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, subject, and body are all required.");
      return;
    }
    const account = accounts.find((a) => a.key === from);
    if (!account) {
      setError("Pick an account to send from.");
      return;
    }
    setSending(true);
    try {
      if (account.key === "gmail") {
        const { connection: refreshed } = await sendGmailMessage(account.connection, { to, subject, body });
        await saveGmailConnection(refreshed);
      } else {
        const { connection: refreshed } = await sendOutlookMessage(account.connection, { to, subject, body });
        await saveOutlookConnection(refreshed);
      }
      onSent();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <form
        onSubmit={handleSend}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">New message</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-2.5">
          {accounts.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-14 shrink-0">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1 bg-transparent border border-input rounded-md px-2 py-1.5 text-sm">
                {accounts.map((a) => (
                  <option key={a.key} value={a.key}>{a.label} — {a.emailAddress || "connected account"}</option>
                ))}
              </select>
            </label>
          )}
          <input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="To" className="text-sm px-3 py-2 rounded-md border border-input bg-background outline-none" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="text-sm px-3 py-2 rounded-md border border-input bg-background outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" rows={8} className="text-sm px-3 py-2 rounded-md border border-input bg-background outline-none resize-none" />
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button type="submit" disabled={sending} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VmailPage() {
  const [folder, setFolder] = useState("inbox");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [errors, setErrors] = useState([]);
  const [appleConnected, setAppleConnected] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const anyConnected = accounts.length > 0 || appleConnected;

  const load = async () => {
    setLoading(true);
    const nextErrors = [];
    const all = [];

    const [gmail, outlook, apple] = await Promise.all([loadGmailConnection(), loadOutlookConnection(), loadAppleMailConnection()]);
    const gmailOn = isGmailConnected(gmail);
    const outlookOn = isOutlookConnected(outlook);
    setAppleConnected(isAppleMailConnected(apple));

    const nextAccounts = [];
    if (gmailOn) nextAccounts.push({ key: "gmail", label: "Gmail", connection: gmail, emailAddress: gmail.emailAddress });
    if (outlookOn) nextAccounts.push({ key: "outlook", label: "Outlook", connection: outlook, emailAddress: outlook.emailAddress });
    setAccounts(nextAccounts);

    if (gmailOn) {
      try {
        const { messages: gmailMessages, connection: refreshed } = await listGmailMessages(gmail, { query: gmailQueryForFolder(folder, search), maxResults: 25 });
        if (refreshed.accessToken !== gmail.accessToken) await saveGmailConnection(refreshed);
        all.push(...gmailMessages.map((m) => ({ id: m.id, provider: "gmail", label: "Gmail", from: m.from.replace(/<.*>/, "").trim() || m.from, subject: m.subject, date: m.date, unread: m.unread })));
      } catch (err) {
        nextErrors.push(`Gmail: ${err.message}`);
      }
    }
    if (outlookOn) {
      try {
        const { messages: outlookMessages, connection: refreshed } = await listOutlookMessages(outlook, { folder: OUTLOOK_FOLDER[folder], query: search, maxResults: 25 });
        if (refreshed.accessToken !== outlook.accessToken) await saveOutlookConnection(refreshed);
        all.push(...outlookMessages.map((m) => ({ id: m.id, provider: "outlook", label: "Outlook", from: m.from, subject: m.subject, date: m.receivedDateTime, unread: m.unread })));
      } catch (err) {
        nextErrors.push(`Outlook: ${err.message}`);
      }
    }

    all.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setMessages(all);
    setErrors(nextErrors);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const runMessageAction = async (message, action) => {
    setBusyId(message.id);
    try {
      if (message.provider === "gmail") {
        const gmail = await loadGmailConnection();
        const { connection: refreshed } = await action.gmail(gmail, message.id);
        await saveGmailConnection(refreshed);
      } else {
        const outlook = await loadOutlookConnection();
        const { connection: refreshed } = await action.outlook(outlook, message.id);
        await saveOutlookConnection(refreshed);
      }
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    } catch (err) {
      setErrors((prev) => [...prev, `${message.label}: ${err.message}`]);
    } finally {
      setBusyId(null);
    }
  };

  const messageActions = useMemo(() => ({
    archive: { gmail: archiveGmailMessage, outlook: archiveOutlookMessage },
    delete: { gmail: trashGmailMessage, outlook: deleteOutlookMessage },
    restore: { gmail: untrashGmailMessage, outlook: restoreOutlookMessage },
    spam: { gmail: markGmailSpam, outlook: markOutlookSpam },
  }), []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={Inbox}
        title="Vmail"
        subtitle="Every connected inbox, in one place"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-input rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={() => setComposeOpen(true)}
              disabled={accounts.length === 0}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
              title={accounts.length === 0 ? "Connect Gmail or Outlook in Settings to compose" : undefined}
            >
              <PenSquare className="w-3.5 h-3.5" /> Compose
            </button>
          </div>
        }
      />

      <div className="px-4 flex items-center gap-3 border-b border-border">
        <nav className="flex items-center gap-1">
          {FOLDERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setFolder(key)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 border-b-2 -mb-px transition-colors ${folder === key ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>
        <form onSubmit={handleSearchSubmit} className="ml-auto py-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search this folder"
            className="bg-transparent outline-none w-40 text-foreground placeholder:text-muted-foreground"
          />
        </form>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-6">
        {!anyConnected && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <Inbox className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Nothing connected yet. Connect Gmail, Outlook, or Apple Mail in Settings and it shows up here.
            </p>
            <Link
              to="/app/settings"
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Go to Settings
            </Link>
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
                    <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {busyId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          {folder !== "archive" && (
                            <button onClick={() => runMessageAction(m, messageActions.archive)} aria-label="Archive" title="Archive" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md">
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {folder !== "junk" && (
                            <button onClick={() => runMessageAction(m, messageActions.spam)} aria-label="Report spam" title="Report spam" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md">
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {folder !== "trash" ? (
                            <button onClick={() => runMessageAction(m, messageActions.delete)} aria-label="Delete" title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => runMessageAction(m, messageActions.restore)} aria-label="Restore" title="Restore" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md">
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {composeOpen && <ComposeModal accounts={accounts} onClose={() => setComposeOpen(false)} onSent={load} />}
    </div>
  );
}
