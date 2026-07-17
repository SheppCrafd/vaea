import { CHAT_ICON_OPTIONS } from "@/hooks/useChatController";
import PositionedPopover from "@/components/shared/PositionedPopover";

// The icon-choice popover — pick a preset or type a custom emoji. Shared by
// the floating widget's header button and the full-page chat's header button.
export default function ChatIconPicker({ iconPicker, iconChoice, chooseIcon }) {
  return (
    <PositionedPopover
      isOpen={iconPicker.isOpen}
      coords={iconPicker.coords}
      close={iconPicker.close}
      panelClassName="fixed bg-card border border-border rounded-lg shadow-2xl p-2 flex flex-col gap-2"
    >
      <div className="flex gap-1">
        {CHAT_ICON_OPTIONS.map(({ key, Icon }) => (
          <button
            key={key}
            onClick={() => chooseIcon({ key })}
            className={`p-1.5 rounded-md hover:bg-secondary ${iconChoice.key === key && !iconChoice.emoji ? "bg-secondary" : ""}`}
            aria-label={key}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = e.target.elements.emoji.value.trim();
          if (value) chooseIcon({ emoji: value.slice(0, 2) });
        }}
        className="flex gap-1"
      >
        <input name="emoji" placeholder="or type an emoji" maxLength={2} className="w-28 text-xs px-2 py-1 bg-background border border-input rounded outline-none" />
        <button type="submit" className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">Use</button>
      </form>
    </PositionedPopover>
  );
}
