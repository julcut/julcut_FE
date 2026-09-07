"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { getAdminProfile } from "@/features/auth/admin/api";
import { useAdminAuthStore } from "@/store/adminAuthStore";

/** 인증이 끊긴 것으로 보고 로그인 화면으로 보낼 응답인지 판단한다. */
function isUnauthenticated(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401;
}

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setProfile = useAdminAuthStore((state) => state.setProfile);
  const profileQuery = useQuery({
    queryKey: ["admin-profile"],
    queryFn: getAdminProfile,
    retry: false,
  });

  useEffect(() => {
    if (profileQuery.data) setProfile(profileQuery.data);
    // 401만 로그인 화면으로 보낸다. 서버 오류나 네트워크 단절로 로그아웃시키면
    // 편집 중이던 작업이 통째로 날아간다.
    if (profileQuery.isError && isUnauthenticated(profileQuery.error)) {
      router.replace("/login?expired=1");
    }
  }, [profileQuery.data, profileQuery.error, profileQuery.isError, router, setProfile]);

  if (profileQuery.isError && !isUnauthenticated(profileQuery.error)) {
    return (
      <div className="col-span-3 flex flex-col items-start gap-4 rounded-lg border border-zinc-300 bg-white px-8 py-6">
        <p className="body-large-bold text-zinc-950">일시적인 오류가 발생했습니다</p>
        <p className="body-small text-zinc-500">
          잠시 후 다시 시도해 주세요. 로그인 상태는 그대로 유지됩니다.
        </p>
        <Button type="button" onClick={() => profileQuery.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!profileQuery.data) {
    return (
      <div role="status" aria-label="불러오는 중" className="col-span-3 flex flex-col gap-4 p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-zinc-100" />
      </div>
    );
  }

  return <>{children}</>;
}
