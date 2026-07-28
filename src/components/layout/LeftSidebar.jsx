import StakeholderList from "@/components/sidebar/StakeholderList";

// No heading of its own — the panel header row in AppShell already titles
// this rail "Stakeholders"; repeating it here read as a ghost line once the
// rail went dark.
export default function LeftSidebar() {
  return (
    <div>
      <StakeholderList />
    </div>
  );
}