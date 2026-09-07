"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getManagedFestival } from "@/features/festivals/api";
import { getApiErrorMessage } from "@/lib/api/httpError";

/**
 * 총괄관리자 전용 화면 가드.
 * 운영자(제2관리자, 초대된 외부업자)는 운영자 대시보드로 보낸다.
 */
export function FestivalOwnerGuard({
  festivalId,
  children,
}: {
  festivalId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const festivalQuery = useQuery({
    queryKey: ["managed-festival", festivalId],
    queryFn: () => getManagedFestival(festivalId),
  });
  const role = festivalQuery.data?.role;

  useEffect(() => {
    if (role === "SUB_ADMIN") {
      router.replace(`/console/festivals/${festivalId}/dashboard`);
    }
  }, [festivalId, role, router]);

  if (festivalQuery.isLoading) {
    return <p className="body-regular text-zinc-500">불러오는 중...</p>;
  }

  if (festivalQuery.isError) {
    return <p className="body-small text-error">{getApiErrorMessage(festivalQuery.error)}</p>;
  }

  if (role !== "FESTIVAL_OWNER") {
    return null;
  }

  return <>{children}</>;
}
