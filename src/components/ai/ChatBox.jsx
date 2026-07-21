import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, ChevronLeft, Paperclip, Maximize2, Info } from "lucide-react";
import { useChatController } from "@/hooks/useChatController";
import { useWindowGeometry } from "@/hooks/useWindowGeometry";
import { useSlashCommand } from "@/hooks/useSlashCommand";
import ChatIcon from "@/components/ai/ChatIcon";
import ChatIconPicker from "@/components/ai/ChatIconPicker";
import ChatMessageList from "@/components/ai/ChatMessageList";
import ChatSessionList from "@/components/ai/ChatSessionList";
import ChatResizeHandles from "@/components/ai/ChatResizeHandles";
import ChatCommandMenu from "@/components/ai/ChatCommandMenu";

// Floating quick-access chat widget. All the actual chat behavior (sessions,
// sending, confirm/undo, icon persistence, attachments) lives in
// useChatController, shared with the full-page chat at /chat — this
// component only owns its own open/collapsed chrome. When open, the panel is
// a draggable/resizable window (useWindowGeometry) rather than pinned to a
// fixed corner, with its position/size persisted across sessions.
export default function ChatBox({ activeProjectId }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSessionListOpen, setIsSessionListOpen] = useState(false);
  const containerRef = useRef(null);
  const messageInputRef = useRef(null);
  const navigate = useNavigate();

  const chat = useChatController({ activeProjectId });
  const { geometry, startMove, startResize } = useWindowGeometry();
  const slashCommand = useSlashCommand(chat.input, chat.setInput);

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
          className="z-[110] font-sans bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in duration-150 transition-none"
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
                <span className="font-semibold text-sm">PM Copilot</span>
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
                <title>Everything else in this app stays on your device. Chat is the one exception: your current data is sent to an AI service to answer you, only for that one exchange — nothing is stored on a server.</title>
              </Info>
              <button
                onClick={() => navigate("/chat")}
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
            <div className="px-3 pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Paperclip className="w-3 h-3" />
              {chat.attachedFile.name}
              <button onClick={() => chat.setAttachedFile(null)} className="text-destructive/80 hover:text-destructive">×</button>
            </div>
          )}

          <form onSubmit={chat.handleSend} className="p-3 bg-card border-t border-border flex items-center gap-2">
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
            <input
              ref={messageInputRef}
              value={chat.input}
              onChange={(e) => chat.setInput(e.target.value)}
              onKeyDown={slashCommand.handleKeyDown}
              placeholder="E.g., Hello... / PLease add... / File a report for..."
              className="flex-1 text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              disabled={chat.isComputing}
              autoComplete="off"
            />
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
        </div>
      ) : (
        <button
          ref={containerRef}
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-[110] w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
        >
          <ChatIcon iconChoice={chat.iconChoice} className="w-6 h-6" />
        </button>
      )}

      <ChatIconPicker iconPicker={chat.iconPicker} iconChoice={chat.iconChoice} chooseIcon={chat.chooseIcon} />

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
