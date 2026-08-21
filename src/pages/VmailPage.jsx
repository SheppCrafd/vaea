import { useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, TriangleAlert, PenSquare, X, Send } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import InboxFrame from "@/components/vmail/InboxFrame";
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
// Folder-nav/search/message-list markup lives in InboxFrame.jsx so the
// marketing demo can render this exact same component instead of a
// hand-built recreation.
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

  const messageActions = useMemo(() => ({
    archive: { gmail: archiveGmailMessage, outlook: archiveOutlookMessage },
    delete: { gmail: trashGmailMessage, outlook: deleteOutlookMessage },
    restore: { gmail: untrashGmailMessage, outlook: restoreOutlookMessage },
    spam: { gmail: markGmailSpam, outlook: markOutlookSpam },
  }), []);

  const runMessageAction = async (message, actionKey) => {
    const action = messageActions[actionKey];
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

      <InboxFrame
        folder={folder}
        onFolderChange={setFolder}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        anyConnected={anyConnected}
        errors={errors}
        appleConnected={appleConnected}
        loading={loading}
        messages={messages}
        busyId={busyId}
        onMessageAction={runMessageAction}
      />

      {composeOpen && <ComposeModal accounts={accounts} onClose={() => setComposeOpen(false)} onSent={load} />}
    </div>
  );
}
