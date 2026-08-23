import { useEffect, useState } from "react";
import { Bell, TriangleAlert, Clock, CircleCheck, Zap, Plus, X, Archive } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAllTasks } from "@/hooks/useTasks";
import { getProjectRiskLevel, formatDueDate } from "@/lib/projectUtils";
import { loadNotificationRules, saveNotificationRules, evaluateRules, RULE_PRESETS } from "@/lib/notificationRules";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";
import { Select } from "@/components/ui/select";

// A real digest built from data the app already has, plus a real (if
// deliberately simple) rule engine: user-defined threshold/status rules,
// evaluated reactively whenever this page loads or its data changes — not a
// background daemon, since this app has no always-on server to run one on.
// Risk is computed via projectUtils.js's getProjectRiskLevel — the same
// function the Agents sidebar card's predictive risk flagging uses, so
// there's one risk computation in the app, not two that can disagree.
// Automation Recipes Library and no-code trigger rules are this SAME engine
// (RULE_PRESETS below), not a separate system.
function Row({ Icon, tone, title, meta }) {
  const toneClass = {
    overdue: "text-destructive",
    at_risk: "text-amber-500",
    info: "text-muted-foreground",
    triggered: "text-primary",
  }[tone];
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${toneClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{title}</p>
        {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
      </div>
    </div>
  );
}

const METRIC_LABELS = {
  overdue_projects: "overdue projects",
  at_risk_projects: "at-risk projects",
  not_started_tasks: "not-started tasks",
};

function RulesCard({ rules, setRules, triggered }) {
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState("overdue_projects");
  const [threshold, setThreshold] = useState(5);

  const addRule = async (e) => {
    e.preventDefault();
    const next = [...rules, { name: `${threshold}+ ${METRIC_LABELS[metric]}`, metric, comparator: "gte", threshold: Number(threshold) }];
    setRules(next);
    await saveNotificationRules(next);
    setAdding(false);
  };

  const addPreset = async (preset) => {
    if (rules.some((r) => r.name === preset.name)) return;
    const next = [...rules, preset];
    setRules(next);
    await saveNotificationRules(next);
  };

  const removeRule = async (name) => {
    const next = rules.filter((r) => r.name !== name);
    setRules(next);
    await saveNotificationRules(next);
  };

  const triggeredNames = new Set(triggered.map((t) => t.rule.name));

  return (
    <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your rules</p>
        <button onClick={() => setAdding((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> New rule
        </button>
      </div>

      {rules.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground py-1">
          No rules yet — add one, or start from a preset below.
        </p>
      )}

      {rules.map((rule) => (
        <div key={rule.name} className="flex items-center gap-2 py-1.5 text-xs">
          <Zap className={`w-3.5 h-3.5 shrink-0 ${triggeredNames.has(rule.name) ? "text-primary" : "text-muted-foreground"}`} />
          <span className="flex-1 truncate">{rule.name}</span>
          {triggeredNames.has(rule.name) && <span className="text-primary font-medium">Triggered</span>}
          <button onClick={() => removeRule(rule.name)} aria-label={`Remove ${rule.name}`} className="text-muted-foreground hover:text-destructive p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {adding && (
        <form onSubmit={addRule} className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Notify when</span>
          <Select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="text-xs px-2 py-1"
            aria-label="Metric"
            options={Object.entries(METRIC_LABELS).map(([key, label]) => ({ value: key, label }))}
          />
          <span className="text-xs text-muted-foreground">is at least</span>
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-14 text-xs px-2 py-1 rounded-md border border-input bg-background"
          />
          <button type="submit" className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md">Add</button>
        </form>
      )}

      {RULE_PRESETS.some((p) => !rules.some((r) => r.name === p.name)) && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
          {RULE_PRESETS.filter((p) => !rules.some((r) => r.name === p.name)).map((preset) => (
            <button
              key={preset.name}
              onClick={() => addPreset(preset)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: tasks = [], isLoading: tasksLoading } = useAllTasks();
  const [rules, setRules] = useState([]);

  useEffect(() => {
    loadNotificationRules().then(setRules);
  }, []);

  const projectRisks = projects
    .map((project) => {
      const projectTasks = tasks.filter((t) => t.project_id === project.id);
      const allDone = projectTasks.length > 0 && projectTasks.every((t) => t.status === "DONE" || t.status === "DELEGATED_DONE");
      return { project, risk: getProjectRiskLevel(project, allDone) };
    })
    .filter(({ risk }) => risk === "overdue" || risk === "at_risk");

  const overdue = projectRisks.filter(({ risk }) => risk === "overdue");
  const atRisk = projectRisks.filter(({ risk }) => risk === "at_risk");
  const notStartedCount = tasks.filter((t) => !t.status || t.status === "NOT_STARTED").length;
  const loading = projectsLoading || tasksLoading;

  const metrics = { overdue_projects: overdue.length, at_risk_projects: atRisk.length, not_started_tasks: notStartedCount };
  const triggered = evaluateRules(rules, metrics);

  const isEmpty = !loading && overdue.length === 0 && atRisk.length === 0 && notStartedCount === 0 && triggered.length === 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader
        Icon={Bell}
        title="Notifications"
        subtitle="What needs your attention right now"
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        <div className="max-w-2xl mx-auto pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : isEmpty ? (
            <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center mb-4">
              <CircleCheck className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Nothing needs your attention</p>
              <p className="text-xs text-muted-foreground mt-1">
                No overdue or at-risk projects, nothing sitting unstarted, and no rule has tripped.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mb-4">
              {triggered.length > 0 && (
                <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Rules triggered — {triggered.length}
                  </p>
                  {triggered.map(({ rule, value }) => (
                    <Row key={rule.name} Icon={Zap} tone="triggered" title={rule.name} meta={`Currently: ${value}`} />
                  ))}
                </div>
              )}
              {overdue.length > 0 && (
                <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Overdue — {overdue.length}
                  </p>
                  {overdue.map(({ project }) => (
                    <Row
                      key={project.id}
                      Icon={TriangleAlert}
                      tone="overdue"
                      title={project.title}
                      meta={`Was due ${formatDueDate(project)}`}
                    />
                  ))}
                </div>
              )}
              {atRisk.length > 0 && (
                <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Due soon — {atRisk.length}
                  </p>
                  {atRisk.map(({ project }) => (
                    <Row
                      key={project.id}
                      Icon={Clock}
                      tone="at_risk"
                      title={project.title}
                      meta={`Due ${formatDueDate(project)}`}
                    />
                  ))}
                </div>
              )}
              {notStartedCount > 0 && (
                <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5">
                  <Row
                    Icon={Clock}
                    tone="info"
                    title={`${notStartedCount} task${notStartedCount === 1 ? "" : "s"} not started yet`}
                    meta="No due-date pressure — just here so nothing's forgotten"
                  />
                </div>
              )}
            </div>
          )}
          {!loading && <RulesCard rules={rules} setRules={setRules} triggered={triggered} />}
          {!loading && (
            <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
              <Archive className="w-3 h-3" /> Auto-archive suggestions and stakeholder follow-up reminders land here in a later pass.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
