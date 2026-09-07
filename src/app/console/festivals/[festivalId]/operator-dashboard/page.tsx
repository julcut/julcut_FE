import { redirect } from "next/navigation";

export default async function OperatorDashboardPage({
  params,
}: {
  params: Promise<{ festivalId: string }>;
}) {
  const { festivalId } = await params;
  redirect(`/console/festivals/${festivalId}/dashboard`);
}
