"use client";

import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAdminProfile } from "@/features/auth/admin/api";
import { useAdminAuthStore } from "@/store/adminAuthStore";

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
    if (profileQuery.isError) {
      router.replace(
        isAxiosError(profileQuery.error) && profileQuery.error.response?.status === 401
          ? "/login?expired=1"
          : "/login",
      );
    }
  }, [profileQuery.data, profileQuery.error, profileQuery.isError, router, setProfile]);

  if (!profileQuery.data) return null;

  return <>{children}</>;
}
