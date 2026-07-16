import React from "react";
import { getStatusCounts } from "@/lib/taskUtils";

// Literal, theme-independent colors — the spec calls for specific colors
// per status ("dark grey", "white...with a thin black border"), not
// surface-adaptive theme tokens. `bg-muted-foreground`/`bg-muted` flip
// lightness between light/dark mode, which silently inverted Blocked to
// light-grey and No-status to dark-on-dark in dark mode.
const BUCKET_STYLE = {
  DONE: { label: "Done", color: "bg-[#86E7B0]" },
  DELEGATED: { label: "Delegated", color: "bg-[#93C5FD]" },
  IN_PROGRESS: { label: "In Prog", color: "bg-[#FDE047]" },
  BLOCKED: { label: "Blocked", color: "bg-[#4B5563]" },
  PENDING_FEEDBACK: { label: "Feedback", color: "bg-[#FDBA74]" },
  ON_HOLD: { label: "On Hold", color: "bg-[#FCA5A5]" },
  NOT_STARTED: { label: "Unstarted", color: "bg-white border border-black" },
};

export default function TaskStatistics({ tasks = [] }) {
  const counts = getStatusCounts(tasks);
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  // If there are no tasks, don't render the component to save space
  if (total === 0) return null;

  const activeStats = counts
    .filter((c) => c.count > 0)
    .map((c) => ({ key: c.key, count: c.count, ...BUCKET_STYLE[c.key] }));

  return (
    <div className="mt-3 pt-3 border-t border-border w-full flex flex-col gap-1.5">
      {/* 1-Row Stacked Bar */}
      <div className="flex w-full h-2 rounded-full overflow-hidden">
        {activeStats.map((item) => (
          <div
            key={item.key}
            className={`h-full ${item.color}`}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>

      {/* Super compact inline legend */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-0.5">
        {activeStats.map((item) => (
          <div key={item.key} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
              {item.label} {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
