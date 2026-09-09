"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrentStaff } from "@/features/auth/staff/api";
import { staffLoginPath } from "@/features/auth/staff/loginPath";
import { useStaffAuthStore } from "@/store/staffAuthStore";

export function StaffAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setSession = useStaffAuthStore((state) => state.setSession);
  const festivalId = useStaffAuthStore((state) => state.festivalId);
  const sessionQuery = useQuery({
    queryKey: ["staff-session"],
    queryFn: getCurrentStaff,
    retry: false,
  });

  useEffect(() => {
    if (sessionQuery.data) setSession(sessionQuery.data);
    // 세션 만료 경로와 마찬가지로 알고 있는 담당 축제 ID를 함께 넘겨야 다시 로그인할 수 있다.
    if (sessionQuery.isError) router.replace(staffLoginPath({ festivalId }));
  }, [festivalId, router, sessionQuery.data, sessionQuery.isError, setSession]);

  if (!sessionQuery.data) return null;
  return <>{children}</>;
}
