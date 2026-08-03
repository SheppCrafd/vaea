import { createContext, useContext } from "react";
import { useChatController } from "@/hooks/useChatController";

const ChatControllerContext = createContext(null);

// One real useChatController instance, created once above the router (see
// App.jsx) so it survives every route change — ChatBox (the floating
// widget, Dashboard-only) and ChatPage (the full-page /chat route) both
// read from here instead of each calling the hook themselves. That used to
// be the actual bug behind "the animation stops when you navigate away":
// each remount span up a brand-new controller with isComputing/
// streamingText/liveSteps/newMessageIds all reset to nothing, orphaning
// whatever the previous instance's still-in-flight handleSend was doing —
// the request itself kept running (nothing cancels it), but nothing was
// left mounted to show its progress, and returning to chat showed a
// controller that had no idea a generation was ever underway.
export function ChatControllerProvider({ children }) {
  const chat = useChatController({});
  return <ChatControllerContext.Provider value={chat}>{children}</ChatControllerContext.Provider>;
}

export function useSharedChatController() {
  const ctx = useContext(ChatControllerContext);
  if (!ctx) throw new Error("useSharedChatController must be used within a ChatControllerProvider");
  return ctx;
}
