import { Plus, Paperclip, Info, Settings } from "lucide-react";
import { useRef, useState } from "react";
import { useChatController } from "@/hooks/useChatController";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import { useAppStore } from "@/lib/store";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatIconPicker from "@/components/ai/ChatIconPicker";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatSessionRow from "@/components/ai/ChatSessionRow";
import ChatCommandMenu from "@/components/ai/ChatCommandMenu";
import ChatSettingsModal from "@/components/ai/ChatSettingsModal";
import ChatAuthPrompt from "@/components/ai/ChatAuthPrompt";

// Full-page chat — a dedicated /chat route (outside the dashboard's AppShell
// chrome entirely) laid out like a standalone chat app: a persistent session
// sidebar on the left (always visible, not a popup, unlike the floating
// widget's history caret) and a full-height centered message thread with the
// composer pinned at the bottom. Shares useChatController with the floating
// ChatBox widget, so switching between the two never loses a session.
//
// The sidebar's open/closed state and its toggle button both moved to
// Header.jsx/useAppStore — it used to be local useState (reset on every
// reload) with its own collapse/expand buttons duplicated in two places
// here (the sidebar's own header, and this page's inner top bar). Now it's
// the same persisted, single-toggle-button pattern every other page's
// sidebar uses.
export default function ChatPage() {
  const isSidebarOpen = useAppStore((s) => s.isChatSidebarOpen);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chat = useChatController({});
  const { data: sessions = [] } = useChatSessions();
  const messageInputRef = useRef(null);
  const slashCommand = useSlashCommand(chat.input, chat.setInput);

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {isSidebarOpen && (
        <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3">
            <button
              onClick={chat.handleNewChat}
              className="w-full flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-secondary text-secondary-foreground border border-border rounded-md hover:opacity-80"
            >
              <Plus className="w-4 h-4" />
              New chat
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
            <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5">Chat History</p>
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
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 shrink-0 border-b border-border flex items-center gap-3 px-4">
          <button
            ref={chat.iconPicker.triggerRef}
            onClick={chat.iconPicker.toggle}
            className="flex items-center gap-2"
            aria-label="Choose chat icon"
          >
            <ChatIcon iconChoice={chat.iconChoice} className="w-5 h-5" />
            <span className="font-heading font-semibold text-sm">{chat.aiIdentity.name || "PM Copilot"}</span>
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
          <ChatMessageList
            messages={chat.chatState.messages}
            isComputing={chat.isComputing}
            iconChoice={chat.iconChoice}
            hasMore={chat.chatState.hasMore}
            onLoadMore={chat.chatState.loadMore}
            resolvingId={chat.resolvingId}
            onConfirm={chat.handleConfirm}
            onCancel={chat.handleCancel}
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
              <input
                ref={messageInputRef}
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={slashCommand.handleKeyDown}
                placeholder={`Message ${chat.aiIdentity.name || "PM Copilot"}...`}
                className="flex-1 text-sm px-4 py-3 bg-card border border-input rounded-xl outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                disabled={chat.isComputing}
                autoComplete="off"
                autoFocus
              />
              <button
                type="submit"
                disabled={chat.isComputing}
                className="shrink-0 text-sm px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50"
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
