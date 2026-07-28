import { useAllTasks } from "@/hooks/useTasks";
import TaskStatistics from "@/components/shared/TaskStatistics";

// One combined stacked bar over every active task — Weekly Focus, Top 3,
// and everything else graph together. Reverted from a per-project breakdown
// (one bar per project) that shipped during the consolidation and regressed
// the original combined view, per design review.
export default function StatisticsChart() {
  const { data: tasks = [] } = useAllTasks();
  return <TaskStatistics tasks={tasks} />;
}
