// The shared h-14 title row every standalone /app/* page (Settings,
// Calendar/Notifications/Workflows/Mind Map) opens with — same pattern
// SettingsPage.jsx already used inline, factored out once it needed to
// repeat identically across several pages rather than copy-pasted each time.
export default function StandalonePageHeader({ Icon, title, subtitle, action }) {
  return (
    <div className="h-14 shrink-0 flex items-center gap-3 px-4">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
