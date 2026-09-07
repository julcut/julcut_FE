import { DashboardPanel } from "@/features/dashboard/DashboardPanel";

export default async function FestivalDashboardPage({
  params,
}: {
  params: Promise<{ festivalId: string }>;
}) {
  const { festivalId } = await params;
  return <DashboardPanel festivalId={festivalId} />;
}
