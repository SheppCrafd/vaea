import React from "react";

export default function TaskStatistics({ tasks = [] }) {
  const stats = {
    Done: 0,
    Delegated: 0,
    "In Prog": 0,
    Blocked: 0,
    Feedback: 0,
    "On Hold": 0,
    Unstarted: 0,
  };

  let total = 0;

  tasks.forEach((t) => {
    if (t.isArchived || t.status === "DELETED") return;
    
    total++;
    const s = (t.status || "").toUpperCase().replace("-", "_");
    
    if (s === "DONE" || s === "DELEGATED_DONE") stats.Done++;
    else if (s === "DELEGATED") stats.Delegated++;
    else if (s === "IN_PROGRESS") stats["In Prog"]++;
    else if (s === "BLOCKED") stats.Blocked++;
    else if (s === "PENDING_FEEDBACK") stats.Feedback++;
    else if (s === "ON_HOLD") stats["On Hold"]++;
    else stats.Unstarted++;
  });

  // If there are no tasks, don't render the component to save space
  if (total === 0) return null;

  const config = [
    { label: "Done", count: stats.Done, color: "bg-[#86E7B0]" },
    { label: "Delegated", count: stats.Delegated, color: "bg-[#93C5FD]" },
    { label: "In Prog", count: stats["In Prog"], color: "bg-[#FDE047]" },
    { label: "Blocked", count: stats.Blocked, color: "bg-muted-foreground" },
    { label: "Feedback", count: stats.Feedback, color: "bg-[#FDBA74]" },
    { label: "On Hold", count: stats["On Hold"], color: "bg-[#FCA5A5]" },
    { label: "Unstarted", count: stats.Unstarted, color: "bg-muted border border-border" },
  ];

  // Only show stats that actually have tasks
  const activeStats = config.filter((c) => c.count > 0);

  return (
    <div className="mt-3 pt-3 border-t border-border w-full flex flex-col gap-1.5">
      {/* 1-Row Stacked Bar */}
      <div className="flex w-full h-2 rounded-full overflow-hidden">
        {activeStats.map((item) => (
          <div
            key={item.label}
            className={`h-full ${item.color}`}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.label}: ${item.count}`}
          />
        ))}
      </div>

      {/* Super compact inline legend */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-0.5">
        {activeStats.map((item) => (
          <div key={item.label} className="flex items-center gap-1">
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