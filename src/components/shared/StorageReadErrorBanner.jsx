import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeReadErrors, retryUnreadable, onExternalChange } from "@/lib/localDb";

const LABELS = {
  areas: "areas", products: "products", projects: "projects", tasks: "tasks",
  stakeholders: "people", departments: "departments", projectNotes: "project notes",
  notes: "notes", chatSessions: "chats", chatMessages: "chat messages",
};

// Shown when a saved collection exists but couldn't be read (localDb.js
// CollectionReadError). Vaea blocks every write to it until a retry
// succeeds, so nothing is overwritten. Also refreshes the board when another
// tab changes the same data.
export default function StorageReadErrorBanner() {
  const queryClient = useQueryClient();
  const [names, setNames] = useState([]);

  useEffect(() => subscribeReadErrors(setNames), []);
  useEffect(() => onExternalChange(() => queryClient.invalidateQueries()), [queryClient]);

  if (!names.length) return null;
  const what = names.map((n) => LABELS[n] || n).join(", ");

  const handleRetry = () => {
    retryUnreadable();
    queryClient.invalidateQueries();
  };

  return (
    <div role="alert" className="flex items-center gap-3 px-4 py-2 bg-destructive/[0.08] border-b border-destructive/20 text-sm">
      <TriangleAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
      <p className="flex-1 min-w-0 text-foreground/90">
        Vaea couldn't read your saved {what}. Nothing has been changed, and editing is paused so nothing is overwritten. Check your connection or data folder, then try again.
      </p>
      <button
        type="button"
        onClick={handleRetry}
        className="shrink-0 text-xs px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
