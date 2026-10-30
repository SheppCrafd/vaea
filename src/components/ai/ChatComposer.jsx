import { Plus } from "lucide-react";

// Vaea Chat's input row: the attach button, the `>` prompt field and Send.
// One copy, used by the floating chat panel (ChatBox, "panel"), the full
// chat page (ChatPage, "page") and the marketing board demo, which passes
// its typed text as a read-only value. `children` is for what hangs off the
// row (the slash-command menu); `fileInput` is the hidden file picker.
const VARIANTS = {
  panel: {
    form: "p-3 bg-card border-t border-foreground/[0.06] flex items-center gap-2",
    attach: "shrink-0 p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors disabled:opacity-50",
    attachIcon: "w-4 h-4",
    field: "flex-1 flex items-center gap-1.5 bg-muted/50 rounded-xl px-3 py-2 shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)] focus-within:ring-1 focus-within:ring-primary/50 transition-all",
    send: "shrink-0 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50",
  },
  page: {
    form: "p-4 flex items-center gap-2",
    attach: "shrink-0 p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors disabled:opacity-50",
    attachIcon: "w-5 h-5",
    field: "flex-1 min-w-0 flex items-center gap-2 bg-card rounded-2xl px-4 py-3 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),0_2px_10px_-4px_hsl(200_30%_12%/0.15)] focus-within:ring-2 focus-within:ring-primary/40 transition-all",
    send: "shrink-0 text-sm px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full transition-all shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.7)] disabled:opacity-50",
  },
};

export default function ChatComposer({
  variant = "panel",
  className,
  onSubmit,
  onAttach,
  attachDisabled = false,
  fileInput = null,
  inputRef,
  value,
  onChange,
  onKeyDown,
  placeholder,
  ariaLabel,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  children,
}) {
  const v = VARIANTS[variant];
  return (
    <form onSubmit={onSubmit} className={className || v.form}>
      <button type="button" onClick={onAttach} disabled={attachDisabled} aria-label="Add attachment" className={v.attach}>
        <Plus className={v.attachIcon} />
      </button>
      {fileInput}
      <div className={v.field}>
        <span className="font-terminal text-primary text-sm select-none">{'>'}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="flex-1 min-w-0 font-terminal text-sm bg-transparent outline-none"
          disabled={disabled}
          readOnly={readOnly}
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>
      <button type="submit" disabled={disabled} className={v.send}>
        Send
      </button>
      {children}
    </form>
  );
}
