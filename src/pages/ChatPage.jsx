import { Plus, Paperclip, Info, Settings, PanelLeft, PanelLeftClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSharedChatController } from "@/lib/ChatControllerContext";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import { useChatInputHistory } from "@/hooks/useChatInputHistory";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAppStore } from "@/lib/store";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatIconPicker from "@/components/ai/ChatIconPicker";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatSessionRow from "@/components/ai/ChatSessionRow";
import ChatCommandMenu from "@/components/ai/ChatCommandMenu";
import ChatSettingsModal from "@/components/ai/ChatSettingsModal";
import ChatAuthPrompt from "@/components/ai/ChatAuthPrompt";
import ChatReflectionConsent from "@/components/ai/ChatReflectionConsent";
import MobileSidebarDrawer from "@/components/shared/MobileSidebarDrawer";
import AgentsCard from "@/components/sidebar/AgentsCard";
import PromptTemplatesCard from "@/components/sidebar/PromptTemplatesCard";

// The session list's own content (New chat button + the list itself), plus
// the Agents and Prompt Templates cards below it — factored out so the
// desktop docked <aside> and the mobile MobileSidebarDrawer can both render
// it without duplicating the JSX.
function ChatHistoryPanelContent({ chat, sessions }) {
  return (
    <>
      <div className="p-3">
        <button
          onClick={chat.handleNewChat}
          className="w-full flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">No previous sessions yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sessions.map((s) => (
              <ChatSessionRow
                key={s.id}
                session={s}
                isActive={s.id === chat.activeSessionId}
                onSelect={chat.handleSelectSession}
                onDeleted={chat.handleNewChat}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border py-1">
        <AgentsCard />
        <PromptTemplatesCard onUse={chat.setInput} />
      </div>
    </>
  );
}

// Full-page chat — a dedicated /chat route (outside the dashboard's AppShell
// chrome entirely) laid out like a standalone chat app: a persistent session
// sidebar on the left (always visible, not a popup, unlike the floating
// widget's history caret) and a full-height centered message thread with the
// composer pinned at the bottom. Reads the one shared useChatController
// instance (ChatControllerContext.jsx, provided once above the router,
// outside this route entirely) instead of creating its own — so navigating
// here, away, and back (or switching to the floating ChatBox widget) never
// loses a session OR orphans an in-flight generation the way two separate
// controller instances used to.
//
// The sidebar's own header row (label + collapse button at the seam
// nearest the main column) and the main column's own header row (which
// shows the matching expand button at that same seam once the sidebar is
// closed, so the button visually stays put) is the pattern this page
// originated — every other page's sidebar (Dashboard's stakeholders,
// Settings' section nav) now follows it too. Open/closed state itself
// lives in useAppStore, persisted, rather than local useState reset on
// every reload.
export default function ChatPage() {
  const isSidebarOpen = useAppStore((s) => s.isChatSidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleChatSidebar);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chat = useSharedChatController();
  const { data: sessions = [] } = useChatSessions();
  const messageInputRef = useRef(null);
  const slashCommand = useSlashCommand(chat.input, chat.setInput);
  const inputHistory = useChatInputHistory({ messages: chat.chatState.messages, input: chat.input, setInput: chat.setInput });
  const location = useLocation();

  // Pre-fill the input when navigated here with location.state.initialMessage
  // (e.g. from ProjectDetailModal's "Brief me on this project" button). Only
  // runs once on mount — intentionally doesn't reset if the location changes
  // after mount, since the user may have started typing.
  useEffect(() => {
    const msg = location.state?.initialMessage;
    if (msg && !chat.input) chat.setInput(msg);
  }, []);

  // Same reasoning as AppShell.jsx's mobile drawers: below md the aside
  // never docks (a 256px sidebar squeezes the thread into an unusable
  // sliver on a phone), and the drawer's own open state is page-local and
  // non-persisted rather than reusing isSidebarOpen, so a mobile visit never
  // force-opens a full-screen drawer just because a desktop session left it
  // open.
  const isMobile = useIsMobile();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // The page itself IS "opened" — no isChatOpen-style toggle here the way
  // ChatBox has one, so this just fires once per real navigation to /chat.
  useEffect(() => {
    chat.notifyChatOpened();
  }, []);

  return (
    <div className="h-full flex overflow-hidden gap-3 px-3 pb-3">
      {!isMobile && isSidebarOpen && (
        <aside className="text-sidebar-foreground w-64 shrink-0 overflow-hidden rounded-2xl bg-sidebar shadow-xl flex flex-col">
          <div className="h-14 shrink-0 flex items-center justify-between pl-4 pr-3">
            <p className="text-sm font-semibold text-foreground truncate">Chat History</p>
            <button
              onClick={toggleSidebar}
              aria-label="Collapse chat history panel"
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <ChatHistoryPanelContent chat={chat} sessions={sessions} />
        </aside>
      )}

      {isMobile && (
        <MobileSidebarDrawer
          isOpen={isMobileDrawerOpen}
          onClose={() => setIsMobileDrawerOpen(false)}
          label="Chat History"
          side="left"
        >
          <ChatHistoryPanelContent chat={chat} sessions={sessions} />
        </MobileSidebarDrawer>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 shrink-0 flex items-center gap-3 px-4">
          {(isMobile || !isSidebarOpen) && (
            <button
              onClick={() => (isMobile ? setIsMobileDrawerOpen(true) : toggleSidebar())}
              aria-label="Expand chat history panel"
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 -ml-2 rounded-md transition-colors shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <button
            ref={chat.iconPicker.triggerRef}
            onClick={chat.iconPicker.toggle}
            className="flex items-center gap-2"
            aria-label="Choose chat icon"
          >
            <ChatIcon iconChoice={chat.iconChoice} className="w-5 h-5" />
            <span className="font-terminal font-semibold text-sm">{chat.aiIdentity.name || "Vaea Chat"}</span>
          </button>
          <Info
            className="w-4 h-4 text-muted-foreground cursor-help ml-auto"
            aria-label="Privacy notice"
          >
            <title>Everything else in this app stays on your device. Chat is the one exception: your current data is sent to an AI service to answer you, only for that one exchange — nothing is stored on a server. If you ask it to, chat can also search the web or read an attached file's contents — same one-exchange rule, nothing persists.</title>
          </Info>
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Chat settings"
            title="Chat settings"
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto">
          <ChatReflectionConsent />

          {chat.reflectionSessionId && chat.reflectionSessionId !== chat.activeSessionId && (
            <button
              onClick={chat.openReflectionSession}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/15 text-primary text-sm font-medium text-left transition-colors"
            >
              Vaea started a new conversation — view it
            </button>
          )}

          <ChatMessageList
            messages={chat.chatState.messages}
            isComputing={chat.isComputing}
            isPlanning={chat.isPlanning}
            liveSteps={chat.liveSteps}
            streamingText={chat.streamingText}
            iconChoice={chat.iconChoice}
            hasMore={chat.chatState.hasMore}
            onLoadMore={chat.chatState.loadMore}
            resolvingId={chat.resolvingId}
            onConfirm={chat.handleConfirm}
            onCancel={chat.handleCancel}
            newMessageIds={chat.newMessageIds}
            onMessageTyped={chat.clearNewMessage}
          />

          {chat.attachedFile && (
            <div className="px-3 pt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="w-3.5 h-3.5" />
              {chat.attachedFile.name}
              <button onClick={() => chat.setAttachedFile(null)} className="text-destructive/80 hover:text-destructive">×</button>
            </div>
          )}

          {chat.authPromptVisible ? (
            <div className="p-4">
              <ChatAuthPrompt onSignIn={chat.signInForChat} onDismiss={chat.dismissAuthPrompt} />
            </div>
          ) : (
            <form onSubmit={chat.handleSend} className="p-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => chat.fileInputRef.current?.click()}
                disabled={chat.isUploadingAttachment}
                aria-label="Add attachment"
                className="shrink-0 p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
              <input ref={chat.fileInputRef} type="file" onChange={chat.handleFileChange} className="hidden" />
              <div className="flex-1 min-w-0 flex items-center gap-2 bg-card rounded-2xl px-4 py-3 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_2px_10px_-4px_hsl(200_30%_12%/0.15)] focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                <span className="font-terminal text-primary text-sm select-none">{'>'}</span>
                <input
                  ref={messageInputRef}
                  value={chat.input}
                  onChange={(e) => chat.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    slashCommand.handleKeyDown(e);
                    if (!e.defaultPrevented) inputHistory.handleKeyDown(e);
                  }}
                  placeholder={`Message ${chat.aiIdentity.name || "Vaea Chat"}...`}
                  aria-label={`Message ${chat.aiIdentity.name || "Vaea Chat"}`}
                  className="flex-1 min-w-0 font-terminal text-sm bg-transparent outline-none"
                  disabled={chat.isComputing}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={chat.isComputing}
                className="shrink-0 text-sm px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full transition-all shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.7)] disabled:opacity-50"
              >
                Send
              </button>
              {slashCommand.isOpen && (
                <ChatCommandMenu
                  inputRef={messageInputRef}
                  matches={slashCommand.matches}
                  activeIndex={slashCommand.activeIndex}
                  onHover={slashCommand.setActiveIndex}
                  onSelect={slashCommand.applyCommand}
                />
              )}
            </form>
          )}
        </div>
      </div>

      <ChatIconPicker iconPicker={chat.iconPicker} iconChoice={chat.iconChoice} chooseIcon={chat.chooseIcon} />

      {isSettingsOpen && <ChatSettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
