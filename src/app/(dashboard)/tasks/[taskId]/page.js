import TaskDetailPage from "@/components/tasks/TaskDetailPage";

export const metadata = {
  title: "Task Details | Task Tracker",
};

export default function Page({ params }) {
  return <TaskDetailPage params={params} />;
}
