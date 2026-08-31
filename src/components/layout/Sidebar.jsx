import FocusFeed from "@/components/sidebar/FocusFeed";
import StatisticsChart from "@/components/sidebar/StatisticsChart";

export default function Sidebar() {
  return (
    <div className="space-y-5">
      <FocusFeed />
      <div className="pt-1">
        <h3 className="font-heading text-[13px] font-semibold tracking-tight px-2 mb-1">All tasks</h3>
        <div className="px-2">
          <StatisticsChart />
        </div>
      </div>
    </div>
  );
}