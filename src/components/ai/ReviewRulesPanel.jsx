import { useEffect, useRef, useState } from "react";
import { X, Lock, RotateCcw, Check } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { Switch } from "@/components/ui/switch";
import { loadAgentBehavior, updateAgentBehavior, subscribeAgentBehavior } from "@/lib/agentBehaviorSettings";
import {
  REVIEW_RULES, DEFAULT_REVIEW_RULES, REMOVABLE_KINDS, LIMIT_RANGE, SHARE_RANGE, normalizeReviewRules,
} from "@/lib/planReview";
import { useReviewRulesPanel, closeReviewRules } from "@/lib/reviewRulesPanel";

// The rules auto-approve's reviewer follows (planReview.js), edited in place.
// Each rule reads as one sentence; its numbers and kinds are edited inside
// the sentence, so what you see is exactly what the reviewer checks. Opened
// from chat (/rules, a held plan's Edit Rules, the Rules button under an
// auto-approved reply) and from Settings. Only the user writes these: the
// assistant has no tool that changes them.
export default function ReviewRulesHost() {
  const { open, rule } = useReviewRulesPanel();
  if (!open) return null;
  return <ReviewRulesPanel focusRule={rule} onClose={closeReviewRules} />;
}

function ReviewRulesPanel({ focusRule, onClose }) {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const focusRef = useRef(null);

  useEffect(() => {
    let live = true;
    loadAgentBehavior().then((s) => live && setSettings(s));
    const off = subscribeAgentBehavior((s) => live && setSettings(s));
    return () => { live = false; off(); };
  }, []);

  // Scroll to the rule that held the plan once, when the rules first load,
  // not again on every save while the user edits other rules.
  const loaded = !!settings;
  useEffect(() => {
    if (loaded && focusRef.current) focusRef.current.scrollIntoView({ block: "nearest" });
  }, [loaded]);

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(t);
  }, [saved]);

  const rules = normalizeReviewRules(settings?.reviewRules);
  const save = async (patch) => {
    setSettings(await updateAgentBehavior(patch));
    setSaved(true);
  };
  const setRule = (id, patch) => save({ reviewRules: { ...rules, [id]: { ...rules[id], ...patch } } });
  const isDefault = JSON.stringify(rules) === JSON.stringify(normalizeReviewRules(DEFAULT_REVIEW_RULES));

  return (
    <Modal
      isOpen
      onClose={onClose}
      label="Review Rules"
      overlayClassName="fixed inset-0 bg-black/40 flex items-center justify-center z-[130] p-4"
      panelClassName="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
    >
      <div className="border-b border-border px-5 sm:px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Review Rules</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Auto-approve runs a removal or restore without asking only if it passes every rule. Vaea checks them itself,
            against your messages and your board, for every AI model.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!settings ? (
        <div className="p-6 text-sm text-muted-foreground">Loading rules…</div>
      ) : (
        <>
          <div className="overflow-y-auto">
            <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 border-b border-border">
              <p id="rules-auto-approve" className="text-sm font-medium">Auto-approve after a review</p>
              <Switch
                checked={!!settings.autoApproveEnabled}
                aria-labelledby="rules-auto-approve"
                onCheckedChange={(v) => save(v ? { autoApproveEnabled: true, approvalQueueEnabled: false } : { autoApproveEnabled: false })}
              />
            </div>
            {!settings.autoApproveEnabled && (
              <p className="px-5 sm:px-6 pt-3 text-xs text-muted-foreground">
                Auto-approve is off, so every plan that removes something waits for your “Yes, do it”. The rules apply once you turn it on.
              </p>
            )}

            <ul className="divide-y divide-border">
              {REVIEW_RULES.map((r) => {
                const on = r.locked || rules[r.id]?.on;
                const focused = r.id === focusRule;
                const labelId = `rule-${r.id}`;
                return (
                  <li
                    key={r.id}
                    ref={focused ? focusRef : undefined}
                    className={`px-5 sm:px-6 py-3.5 flex items-start gap-3 ${focused ? "bg-destructive/[0.05] shadow-[inset_3px_0_0_hsl(var(--destructive))]" : ""}`}
                  >
                    <div className="w-9 shrink-0 pt-0.5 flex justify-center">
                      {r.locked ? (
                        <Lock className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" aria-label="Always on" />
                      ) : (
                        <Switch checked={on} aria-labelledby={labelId} onCheckedChange={(v) => setRule(r.id, { on: v })} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p id={labelId} className="text-sm font-medium flex flex-wrap items-baseline gap-x-2">
                        {r.title}
                        {r.locked && <span className="text-[11px] font-normal text-muted-foreground">Always on</span>}
                      </p>
                      <div className={`mt-0.5 text-[13px] leading-relaxed ${on ? "text-foreground/80" : "text-muted-foreground/70"}`}>
                        <RuleSentence rule={r} rules={rules} disabled={!on} setRule={setRule} />
                      </div>
                      {focused && <p className="mt-1.5 text-xs text-destructive/90">This rule held your last plan.</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-border px-5 sm:px-6 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isDefault}
              onClick={() => save({ reviewRules: normalizeReviewRules(DEFAULT_REVIEW_RULES) })}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Defaults
            </button>
            <span aria-live="polite" className="text-[11px] text-muted-foreground flex items-center gap-1 min-h-4">
              {saved && <><Check className="w-3.5 h-3.5" /> Saved</>}
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}

// The rule as a sentence, with its settings edited in place.
function RuleSentence({ rule, rules, disabled, setRule }) {
  if (rule.id === "limit") {
    return (
      <>
        It removes at most{" "}
        <InlineNumber
          label="Most items one plan can remove"
          value={rules.limit.max}
          range={LIMIT_RANGE}
          disabled={disabled}
          onCommit={(max) => setRule("limit", { max })}
        />{" "}
        {rules.limit.max === 1 ? "item" : "items"}, counting everything each delete takes with it.
      </>
    );
  }
  if (rule.id === "share") {
    return (
      <>
        It removes no more than{" "}
        <InlineNumber
          label="Largest share of one kind a plan can remove, in percent"
          value={rules.share.percent}
          range={SHARE_RANGE}
          disabled={disabled}
          suffix="%"
          onCommit={(percent) => setRule("share", { percent })}
        />{" "}
        of your areas, products, projects or tasks.
      </>
    );
  }
  if (rule.id === "kinds") {
    const allowed = new Set(rules.kinds.allowed);
    return (
      <>
        It removes only the kinds turned on here.
        <span className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Kinds auto-approve can remove">
          {REMOVABLE_KINDS.map(([collection, label]) => {
            const pressed = allowed.has(collection);
            return (
              <button
                key={collection}
                type="button"
                aria-pressed={pressed}
                disabled={disabled}
                onClick={() => setRule("kinds", { allowed: REMOVABLE_KINDS.map(([c]) => c).filter((c) => (c === collection ? !pressed : allowed.has(c))) })}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                  pressed ? "border-foreground/30 bg-foreground/[0.06] text-foreground" : "border-dashed border-border text-muted-foreground line-through decoration-muted-foreground/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </span>
      </>
    );
  }
  return rule.text(rules);
}

// A number set inside a sentence. Saves on Enter or when focus leaves, pulled
// back inside its range; Escape puts the saved value back.
function InlineNumber({ value, range, disabled, suffix = "", label, onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || draft.trim() === "") { setDraft(String(value)); return; }
    const clamped = Math.min(range.max, Math.max(range.min, n));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <span className="inline-flex items-baseline">
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={range.min}
        max={range.max}
        step={range.step || 1}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { e.stopPropagation(); setDraft(String(value)); }
        }}
        style={{ width: `${Math.max(2, draft.length) + 1}ch` }}
        className="font-terminal text-[13px] text-foreground text-center bg-transparent border-0 border-b border-dashed border-foreground/40 rounded-none px-0.5 py-0 focus:outline-none focus-visible:border-solid focus-visible:border-primary disabled:text-muted-foreground disabled:border-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix}
    </span>
  );
}
