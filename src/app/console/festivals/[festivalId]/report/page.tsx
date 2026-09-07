import { FestivalOwnerGuard } from "@/components/auth/FestivalOwnerGuard";
import { ReportFlow } from "@/features/report/ReportFlow";

export default async function OperationReportPage({
  params,
}: {
  params: Promise<{ festivalId: string }>;
}) {
  const { festivalId } = await params;
  return (
    <FestivalOwnerGuard festivalId={festivalId}>
      <ReportFlow key={festivalId} festivalId={festivalId} />
    </FestivalOwnerGuard>
  );
}
