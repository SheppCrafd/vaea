import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import AiPreferencesSection from "@/components/settings/AiPreferencesSection";
import AiModelSection from "@/components/settings/AiModelSection";
import ExternalVaultSection from "@/components/settings/ExternalVaultSection";
import ResourcesSection from "@/components/settings/ResourcesSection";

// A quick-access subset of /settings, reachable from wherever you're
// actually chatting (the floating ChatBox and the full /chat page) instead
// of leaving to the standalone Settings page. Only and all chat-owned
// settings belong here — the assistant's own identity (AiPreferencesSection),
// which model answers it (AiModelSection), the vault only its own tools
// read/write (ExternalVaultSection), and where to learn more about that
// vault (ResourcesSection). Deliberately NOT Account or Appearance (whole-app,
// not chat's), and NOT Backup & Restore either — that snapshot/restore net
// also covers CSV import's own bulk writes (csvImport.js), a plain UI
// feature with nothing to do with chat, so it isn't chat-exclusive the way
// everything else here is; it stays a /settings-only section. Reuses the
// exact same section components /settings renders, so there's one
// implementation of each, not a copy.
export default function ChatSettingsModal({ onClose }) {
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[120] p-4" onClick={onClose}>
        <div
          className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Vaea Chat Settings</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 flex flex-col gap-6">
            <AiPreferencesSection />
            <AiModelSection />
            <ExternalVaultSection />
            <ResourcesSection />
          </div>
        </div>
      </div>
    </Portal>
  );
}
