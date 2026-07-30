import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, ChevronLeft, Paperclip, Maximize2, Info, Settings } from "lucide-react";
import { useChatController } from "@/hooks/useChatController";
import { useWindowGeometry } from "@/hooks/useWindowGeometry";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import { useChatInputHistory } from "@/hooks/useChatInputHistory";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatIconPicker from "@/components/ai/ChatIconPicker";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatSessionList from "@/components/ai/ChatSessionList";
import ChatResizeHandles from "@/components/ai/ChatResizeHandles";
import ChatCommandMenu from "@/components/ai/ChatCommandMenu";
import ChatSettingsModal from "@/components/ai/ChatSettingsModal";
import ChatAuthPrompt from "@/components/ai/ChatAuthPrompt";
import ChatReflectionConsent from "@/components/ai/ChatReflectionConsent";

// Floating quick-access chat widget. All the actual chat behavior (sessions,
// sending, confirm/undo, icon persistence, attachments) lives in
// useChatController, shared with the full-page chat at /chat — this
// component only owns its own open/collapsed chrome. When open, the panel is
// a draggable/resizable window (useWindowGeometry) rather than pinned to a
// fixed corner, with its position/size persisted across sessions.
export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef(null);
  const messageInputRef = useRef(null);
  const navigate = useNavigate();

  const chat = useChatController({ activeProjectId });
  const { geometry, startMove, startResize } = useWindowGeometry();
  const slashCommand = useSlashCommand(chat.input, chat.setInput);
  const inputHistory = useChatInputHistory({ messages: chat.chatState.messages, input: chat.input, setInput: chat.setInput });

  // The "opened" signal reflectionTrigger.js waits for — fires only when the
  // panel actually opens (false -> true), not on this component's own
  // mount, which happens on every dashboard load while the widget is still
  // collapsed.
  useEffect(() => {
    if (isChatOpen) chat.notifyChatOpened();
  }, [isChatOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // The icon picker, session list, and slash-command menu all render in
      // a Portal (outside this container's DOM subtree), so skip the
      // outside-click close while any is open — otherwise clicking them
      // would close the whole chat panel before their own click handler
      // ever runs (the command menu's own items only preventDefault the
      // mousedown to avoid stealing input focus, so it still bubbles here).
      if (chat.iconPicker.isOpen || isSessionListOpen || slashCommand.isOpen) return;
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsChatOpen(false);
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [chat.iconPicker.isOpen, isSessionListOpen, slashCommand.isOpen]);

  const selectSession = (id) => {
    chat.handleSelectSession(id);
    setIsSessionListOpen(false);
  };

  const startNewChat = () => {
    chat.handleNewChat();
    setIsSessionListOpen(false);
  };

  const handleHeaderMouseDown = (e) => {
    // Only drag from the header's own background, not one of its buttons.
    if (e.target === e.currentTarget) startMove(e);
  };

  return (
    <>
      {isChatOpen ? (
        <div
          ref={containerRef}
          style={{ position: "fixed", left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }}
          className="z-[110] font-sans bg-card shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_28px_58px_-12px_hsl(200_30%_12%/0.35)] rounded-2xl flex flex-col overflow-hidden animate-in fade-in duration-150 transition-none"
        >
          <ChatResizeHandles startResize={startResize} />

          <div
            onMouseDown={handleHeaderMouseDown}
            className="bg-primary px-4 py-3 flex items-center justify-between text-primary-foreground cursor-move select-none"
          >
            <div className="flex flex-col items-start gap-0.5">
              <button
                ref={chat.iconPicker.triggerRef}
                onClick={chat.iconPicker.toggle}
                className="flex items-center gap-2"
                aria-label="Choose chat icon"
              >
                <ChatIcon iconChoice={chat.iconChoice} className="w-5 h-5" />
                <span className="font-terminal font-semibold text-sm">{chat.aiIdentity.name || "Vaea Chat"}</span>
              </button>
              <button
                onClick={() => setIsSessionListOpen((v) => !v)}
                aria-label="Chat history"
                className="text-primary-foreground/70 hover:text-primary-foreground -mt-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Info
                className="w-3.5 h-3.5 text-primary-foreground/70 cursor-help"
                aria-label="Privacy notice"
              >
                <title>Everything else in this app stays on your device. Chat is the one exception: your current data is sent to an AI service to answer you, only for that one exchange — nothing is stored on a server. If you ask it to, chat can also search the web or read an attached file's contents — same one-exchange rule, nothing persists.</title>
              </Info>
              <button
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Chat settings"
                title="Chat settings"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigate("/app/chat")}
                aria-label="Expand to full page"
                title="Expand to full page"
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsChatOpen(false)} aria-label="Collapse chat" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <ChatReflectionConsent />

          {/* Vaea started a new conversation while this one was open (or
              while the panel was collapsed) — flagged, not force-switched:
              silently yanking the user into a different session mid-read
              would be exactly the "does something without asking" behavior
              this whole feature is built to avoid. */}
          {chat.reflectionSessionId && chat.reflectionSessionId !== chat.activeSessionId && (
            <button
              onClick={chat.openReflectionSession}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium text-left transition-colors"
            >
              Vaea started a new conversation — view it
            </button>
          )}

          <ChatMessageList
            messages={chat.chatState.messages}
            isComputing={chat.isComputing}
            liveSteps={chat.liveSteps}
            streamingText={chat.streamingText}
            iconChoice={chat.iconChoice}
            hasMore={chat.chatState.hasMore}
            onLoadMore={chat.chatState.loadMore}
            resolvingId={chat.resolvingId}
            onConfirm={chat.handleConfirm}
            onCancel={chat.handleCancel}
            newMessageIds={chat.newMessageIds}
          />

          {chat.attachedFile && (
            <div className="px-3 pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              {chat.attachedFile.name}
              <button onClick={() => chat.setAttachedFile(null)} className="text-destructive/80 hover:text-destructive">×</button>
            </div>
          )}

          {chat.authPromptVisible ? (
            <ChatAuthPrompt onSignIn={chat.signInForChat} onDismiss={chat.dismissAuthPrompt} />
          ) : (
            <form onSubmit={chat.handleSend} className="p-3 bg-card border-t border-foreground/[0.06] flex items-center gap-2">
              <button
                type="button"
                onClick={() => chat.fileInputRef.current?.click()}
                disabled={chat.isUploadingAttachment}
                aria-label="Add attachment"
                className="shrink-0 p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
              <input ref={chat.fileInputRef} type="file" onChange={chat.handleFileChange} className="hidden" />
              <div className="flex-1 flex items-center gap-1.5 bg-muted/50 rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)] focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                <span className="font-terminal text-primary text-sm select-none">{'>'}</span>
                <input
                  ref={messageInputRef}
                  value={chat.input}
                  onChange={(e) => chat.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    slashCommand.handleKeyDown(e);
                    if (!e.defaultPrevented) inputHistory.handleKeyDown(e);
                  }}
                  placeholder="E.g., Hello... / PLease add... / File a report for..."
                  aria-label={`Message ${chat.aiIdentity?.name || "Vaea Chat"}`}
                  className="flex-1 min-w-0 font-terminal text-sm bg-transparent outline-none"
                  disabled={chat.isComputing}
                  autoComplete="off"
                />
              </div>
              <button type="submit" disabled={chat.isComputing} className="shrink-0 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50">
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
      ) : (
        <button
          ref={containerRef}
          onClick={() => setIsChatOpen(true)}
          // `fixed` already establishes a positioning context for an
          // absolutely-positioned child (the unread dot below) on its own —
          // an extra `relative` here would conflict with `fixed` (both set
          // the same `position` property) and silently knock the button out
          // of its pinned corner into normal document flow.
          className="fixed bottom-6 right-6 z-[110] w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_16px_36px_-12px_hsl(var(--primary)/0.55)] hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_20px_44px_-12px_hsl(var(--primary)/0.65)] hover:-translate-y-1 transition-all duration-300"
        >
          <ChatIcon iconChoice={chat.iconChoice} className="w-6 h-6" />
          {/* Vaea started a check-in while the panel was collapsed — a plain
              presence dot, not a count; the reflection is a single session,
              never a queue. */}
          {chat.reflectionSessionId && (
            <span aria-hidden="true" className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_0_2px_hsl(var(--primary))]" />
          )}
        </button>
      )}

      <ChatIconPicker iconPicker={chat.iconPicker} iconChoice={chat.iconChoice} chooseIcon={chat.chooseIcon} />

      {isSettingsOpen && <ChatSettingsModal onClose={() => setIsSettingsOpen(false)} />}

      {isSessionListOpen && (
        <ChatSessionList
          activeSessionId={chat.activeSessionId}
          onSelect={selectSession}
          onNewChat={startNewChat}
          onDeleted={startNewChat}
          onClose={() => setIsSessionListOpen(false)}
          anchor={{ x: geometry.x, y: geometry.y }}
        />
      )}
    </>
  );
}
