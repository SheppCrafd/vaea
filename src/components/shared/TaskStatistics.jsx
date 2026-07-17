import React from "react";
import { getStatusCounts, STATUS_COLORS } from "@/lib/taskUtils";

// Short legend labels per bucket — colors come from the shared
// STATUS_COLORS (taskUtils.js) so any other consumer (e.g. the Open
// Questions card echoing "pending feedback" orange) uses the exact same hex.
const BUCKET_LABEL = {
  DONE: "Done",
  DELEGATED: "Delegated",
  IN_PROGRESS: "In Prog",
  BLOCKED: "Blocked",
  PENDING_FEEDBACK: "Feedback",
  ON_HOLD: "On Hold",
  NOT_STARTED: "Unstarted",
};

export default function TaskStatistics({ tasks = [] }) {
  const counts = getStatusCounts(tasks);
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  // If there are no tasks, don't render the component to save space
  if (total === 0) return null;

  const activeStats = counts
    .filter((c) => c.count > 0)
    .map((c) => ({ key: c.key, count: c.count, label: BUCKET_LABEL[c.key], color: STATUS_COLORS[c.key] }));

  return (
    <div className="mt-3 pt-3 border-t border-border w-full flex flex-col gap-1.5">
      {/* 1-Row Stacked Bar */}
      <div className="flex w-full h-2 rounded-full overflow-hidden">
        {activeStats.map((item) => (
          <div
            key={item.key}
            className="h-full"
            style={{ width: `${(item.count / total) * 100}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>

      {/* Super compact inline legend */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-0.5">
        {activeStats.map((item) => (
          <div key={item.key} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
              {item.label}: {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
