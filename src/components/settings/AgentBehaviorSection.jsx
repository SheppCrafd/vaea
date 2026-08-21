import { useEffect, useState } from "react";
import { loadAgentBehavior, saveAgentBehavior } from "@/lib/agentBehaviorSettings";

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

// Three opt-in agent-autonomy toggles — off by default, each widening what
// the assistant is allowed to do on its own rather than something that
// changes the default experience. See agentBehaviorSettings.js.
export default function AgentBehaviorSection() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadAgentBehavior().then(setSettings);
  }, []);

  const update = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveAgentBehavior(next);
  };

  if (!settings) return null;

  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Agent Behavior</p>
      <p className="text-xs text-muted-foreground mb-4">
        All three are off by default — Vaea Chat behaves exactly as it does today unless you turn one on.
      </p>
      <Toggle
        checked={settings.approvalQueueEnabled}
        onChange={(v) => update({ approvalQueueEnabled: v })}
        label="Approve every action, not just destructive ones"
        description="Normally only deletes and other destructive changes need a confirm click. Turn this on and everything the assistant wants to do waits for your Yes first."
      />
      <Toggle
        checked={settings.multiModelComparisonEnabled}
        onChange={(v) => update({ multiModelComparisonEnabled: v })}
        label="Compare answers across models"
        description="If you've connected more than one Bring Your Own Key provider, show each one's answer side by side instead of picking one automatically."
      />
      <Toggle
        checked={settings.autoSchedulingEnabled}
        onChange={(v) => update({ autoSchedulingEnabled: v })}
        label="Let Vaea Calendar auto-schedule tasks"
        description="Give a task a duration and Vaea Calendar finds and blocks real time for it on its own. Off by default — your calendar only changes when you ask."
      />
    </div>
  );
}
