import { Video } from "lucide-react";
import StandalonePageHeader from "@/components/shared/StandalonePageHeader";

// Real functionality here (meeting notes, action-item extraction,
// meeting-to-task linking, pre-meeting briefing, decision extraction) needs
// a Zoom/Google Meet/Microsoft Teams transcript connector — each requires a
// new OAuth app (Zoom) or expanded, re-consented scopes on the existing
// Google/Microsoft connections, none of which this app can register on its
// own. Shipping an honest "not yet" beats faking a meetings list with no
// real data behind it.
export default function MeetingsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <StandalonePageHeader Icon={Video} title="Meetings" subtitle="Notes, action items, and decisions from your calls" />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        <div className="max-w-2xl mx-auto pt-4">
          <div className="card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-8 text-center">
            <Video className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No meeting source connected yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              This page will connect to Zoom, Google Meet, and Microsoft Teams so meeting notes,
              action items, and decisions land here and on the right project automatically. Those
              connections aren't built yet — nothing to set up here in the meantime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
