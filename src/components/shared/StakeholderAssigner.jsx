import { Plus } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import Avatar from "@/components/shared/Avatar";
import MultiSelectPopover from "@/components/shared/MultiSelectPopover";

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

  // Safe subset for rendering the mini-avatars
  const assigned = allStakeholders.filter(s => currentStakeholderIds.includes(s.id));
  const showAddIcon = forceAddIcon || assigned.length === 0;

  return (
    <>
      {/* TRIGGER: The Avatar Stack, or a Plus button if empty/forced */}
      <button
        type="button"
        ref={triggerRef}
        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity min-h-[24px] min-w-[24px] bg-transparent border-0 p-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={toggle}
        title="Assign Stakeholders"
        aria-label="Assign Stakeholders"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {showAddIcon ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <div className="w-6 h-6 shrink-0 rounded-full bg-secondary border border-border flex items-center justify-center">
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
              <div
                className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold"
                style={{ marginLeft: '-10px', zIndex: 0 }}
                title={assigned.slice(5).map((s) => s.name).join(", ")}
              >
                +{assigned.length - 5}
              </div>
            )}
          </div>
        )}
      </button>

      {/* DROPDOWN MENU (Portal at document root, overlay click closes it) */}
      <MultiSelectPopover
        isOpen={isOpen}
        coords={coords}
        close={close}
        className="w-48"
        headerLabel="Assign Stakeholders"
        items={allStakeholders}
        getId={(s) => s.id}
        getLabel={(s) => (
          <span>{s.name} <span className="text-[10px] text-muted-foreground ml-1">({s.department})</span></span>
        )}
        selectedIds={currentStakeholderIds}
        onSave={onSave}
        emptyMessage="No stakeholders yet — add one from the Stakeholders panel."
      />
    </>
  );
}
