"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { StaffBadge } from "@/components/ui/RoleBadge";
import { logoutStaff } from "@/features/auth/staff/api";
import { staffLoginPath } from "@/features/auth/staff/loginPath";
import { useStaffAuthStore } from "@/store/staffAuthStore";

/** 스태프 전용 화면 상단바. 로그인한 뒤에만 부스 검색·로그아웃 액션이 보인다. */
export function StaffHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useStaffAuthStore((state) => state.session);
  const festivalId = useStaffAuthStore((state) => state.festivalId);
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const isLoggedIn = session !== null;
  const logoutMutation = useMutation({ mutationFn: logoutStaff });

  return (
    /*
      노치·다이나믹 아일랜드 아래로 내려 준다. safe-area 값이 0인 기기(데스크톱 등)에서는
      지금까지와 같은 높이 그대로다.
    */
    <header className="shrink-0 border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
      <div className="flex h-12 items-center justify-between gap-2 px-5">
        <Link
          // 로그인 화면으로 돌아갈 때도 축제 ID를 잃으면 다시 로그인할 수 없다.
          href={isLoggedIn ? "/staff/dashboard" : staffLoginPath({ festivalId })}
          className="flex min-w-0 items-center gap-2"
        >
          {/* 콘솔 헤더와 같은 워드마크. `primary` 변경에 영향받지 않도록 색을 직접 지정한다. */}
          <span className="flex h-8 w-12 shrink-0 items-center justify-center bg-zinc-200">
            <span className="body-small-bold text-zinc-900">축지법</span>
          </span>
          <StaffBadge className="shrink-0" />
        </Link>

        {isLoggedIn ? (
          <div className="flex shrink-0 items-center gap-3">
            <IconButton
              variant="ghost"
              aria-label="부스 검색"
              icon={<MagnifyingGlassIcon />}
              // Radix 아이콘은 15px로 고정돼 있어 감싸는 상자만 키워서는 커지지 않는다.
              iconClassName="size-6 text-zinc-950 [&_svg]:size-6"
              onClick={() => router.push("/staff/booths")}
            />
            <Button
              variant="outline"
              size="sm"
              className="px-2 py-1"
              onClick={() => setLogoutOpen(true)}
            >
              로그아웃
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="로그아웃하시겠습니까?"
        confirmLabel="로그아웃"
        overlayClassName="top-0"
        className="p-6"
        onConfirm={async () => {
          // 세션을 지우기 전에 담당 축제 ID를 읽어 둬야 로그인 화면에 다시 실어 줄 수 있다.
          const loginPath = staffLoginPath({ festivalId: session?.festivalId ?? festivalId });
          await logoutMutation.mutateAsync();
          setLogoutOpen(false);
          clearSession();
          queryClient.removeQueries({ queryKey: ["staff-session"] });
          router.replace(loginPath);
        }}
      />
    </header>
  );
}
