import { Check, Plus } from "lucide-react";
import Portal from "@/lib/Portal";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import Avatar from "@/components/shared/Avatar";

export default function StakeholderAssigner({
  currentStakeholderIds = [],
  allStakeholders = [],
  onSave,
  // Always render the plain "+" trigger, never the avatar stack — for
  // contexts (like the Project Stakeholders modal header) that already show
  // a full avatar breakdown elsewhere, where repeating it on the trigger
  // itself is redundant. Purely visual: the trigger still opens the exact
  // same assign dropdown either way.
  forceAddIcon = false,
  // Optional text next to the "+" icon, for standalone contexts where a bare
  // plus is ambiguous among several other icon-only buttons.
  label,
}) {
  const { isOpen, coords, triggerRef, toggle, close } = usePositionedMenu({ closeOnScroll: true });

  const toggleStakeholder = (id) => {
    const newIds = currentStakeholderIds.includes(id)
      ? currentStakeholderIds.filter((existingId) => existingId !== id)
      : [...currentStakeholderIds, id];

    onSave(newIds);
  };

  // Safe subset for rendering the mini-avatars
  const assigned = allStakeholders.filter(s => currentStakeholderIds.includes(s.id));
  const showAddIcon = forceAddIcon || assigned.length === 0;

  return (
    <>
      {/* TRIGGER: The Avatar Stack, or a Plus button if empty/forced */}
      <div
        ref={triggerRef}
        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity min-h-[24px] min-w-[24px]"
        onClick={toggle}
        title="Assign Stakeholders"
      >
        {showAddIcon ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <div className="w-6 h-6 shrink-0 rounded-full bg-secondary border border-dashed border-border flex items-center justify-center">
              <Plus className="w-3 h-3" />
            </div>
            {label && <span className="text-xs whitespace-nowrap">{label}</span>}
          </div>
        ) : (
          <div className="flex pl-2">
            {assigned.slice(0, 5).map((s, i) => (
              <div key={s.id} style={{ marginLeft: '-10px', zIndex: 10 - i }}>
                <Avatar name={s.name} avatarUrl={s.avatar_url} size="sm" />
              </div>
            ))}
            {assigned.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold" style={{ marginLeft: '-10px', zIndex: 0 }}>
                +{assigned.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DROPDOWN MENU (Portal at document root, overlay click closes it) */}
      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999]" onClick={close}>
            <div
              className="fixed w-48 max-h-64 overflow-y-auto bg-card border border-border rounded-md shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-100"
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 border-b border-border mb-1">
                Assign Stakeholders
              </p>
              {allStakeholders.map((s) => {
                const isAssigned = currentStakeholderIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStakeholder(s.id)}
                    className="w-full text-left px-2 py-1.5 text-xs flex items-center justify-between hover:bg-secondary rounded-sm transition-colors"
                  >
                    <span>{s.name} <span className="text-[10px] text-muted-foreground ml-1">({s.department})</span></span>
                    {isAssigned && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
