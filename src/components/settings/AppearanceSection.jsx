import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useAccentTheme, ACCENT_THEMES } from "@/hooks/useAccentTheme";
import { SettingsCard } from "@/components/ui/settings-card";

const MODE_OPTIONS = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

// Theme mode (next-themes, toggles the `dark` class Tailwind is already
// configured for) + accent color (useAccentTheme, a `data-accent` attribute
// matched by CSS variable overrides in index.css). Curated presets, not a
// raw color picker, so every combination stays coherent.
export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccentTheme();

  return (
    <SettingsCard>
      <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Appearance</p>

      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Theme</p>
        <div className="flex gap-2">
          {MODE_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTheme(key)}
              className={`flex-1 flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border text-xs font-medium transition-colors ${
                theme === key ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Accent color</p>
        <div className="flex gap-3">
          {ACCENT_THEMES.map(({ key, label, swatch }) => (
            <button key={key} type="button" onClick={() => setAccent(key)} aria-label={label} title={label} className="flex flex-col items-center gap-1.5">
              <span className={`p-0.5 rounded-full border-2 transition-colors ${accent === key ? "border-foreground" : "border-transparent"}`}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: swatch }}>
                  {accent === key && <Check className="w-4 h-4 text-white" />}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}
