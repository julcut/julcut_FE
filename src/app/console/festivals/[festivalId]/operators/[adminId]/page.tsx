import Link from "next/link";
import { FestivalOwnerGuard } from "@/components/auth/FestivalOwnerGuard";
import { SubAdminDetailPanel } from "@/features/operators/SubAdminDetailPanel";

export default async function SubAdminDetailPage({
  params,
}: {
  params: Promise<{ festivalId: string; adminId: string }>;
}) {
  const { festivalId, adminId } = await params;
  return (
    <FestivalOwnerGuard festivalId={festivalId}>
      <div className="col-span-3 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="heading-small">운영자 상세 조회 (관리자)</h1>
          <Link
            href={`/console/festivals/${festivalId}/operators`}
            className="body-small underline"
          >
            목록으로
          </Link>
        </div>
        <SubAdminDetailPanel festivalId={festivalId} adminId={adminId} />
      </div>
    </FestivalOwnerGuard>
  );
}
