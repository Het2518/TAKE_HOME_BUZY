import ProjectDetailPage from "@/components/projects/ProjectDetailPage";

export const metadata = {
  title: "Project Details | Task Tracker",
};

export default function Page({ params }) {
  return <ProjectDetailPage params={params} />;
}

