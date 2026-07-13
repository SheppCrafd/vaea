import StatisticsChart from "@/components/sidebar/StatisticsChart";
import StakeholderList from "@/components/sidebar/StakeholderList";

export default function Sidebar() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-heading font-semibold text-sm mb-3">Task Statistics</p>
        <StatisticsChart />
      </div>
      <div>
        <p className="font-heading font-semibold text-sm mb-2">Stakeholders</p>
        <StakeholderList />
      </div>
    </div>
  );
}