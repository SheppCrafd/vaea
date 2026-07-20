import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppearanceSection from "@/components/settings/AppearanceSection";

// A standalone /settings route (outside AppShell's three-column dashboard
// chrome, same treatment ChatPage already gets) — no sidebars/hamburgers
// needed here, just a simple header and a stack of section cards.
export default function SettingsPage() {
  return (
    <div className="h-screen overflow-y-auto bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <h1 className="font-heading text-lg font-semibold">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6">
        <AppearanceSection />
      </div>
    </div>
  );
}
