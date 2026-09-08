"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";
import { AdminAuthGuard } from "@/components/auth/AdminAuthGuard";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { Toaster } from "@/components/ui/sonner";
import { getManagedFestival } from "@/features/festivals/api";
import { canCreateFestival } from "@/features/auth/admin/types";
import { cn } from "@/lib/utils";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { useConsoleUiStore } from "@/store/consoleUiStore";

/** 특정 축제 범위가 없는 화면(메인홈, 축제등록)은 5개 탭 대신 "축제등록" 버튼만 노출한다. */
const HOME_NAV_ITEMS = [{ label: "축제등록", href: "/console/festivals/new" }];
const HOME_NAV_PATHS = ["/console", "/console/festivals/new", "/console/mypage"];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const adminName = useAdminAuthStore((state) => state.session?.admin.name);
  const accountRole = useAdminAuthStore((state) => state.session?.admin.role);
  const accountKind = useAdminAuthStore((state) => state.session?.admin.accountKind);
  const hideNav = useConsoleUiStore((state) => state.hideNav);
  const fullBleed = useConsoleUiStore((state) => state.fullBleed);
  const pathname = usePathname();
  const params = useParams<{ festivalId?: string }>();
  const festivalId = params?.festivalId;
  const isHomeScope = Boolean(pathname && HOME_NAV_PATHS.includes(pathname));
  const homeNavItems = canCreateFestival(accountKind) ? HOME_NAV_ITEMS : [];
  const navItems = isHomeScope ? homeNavItems : undefined;
  const hideHomeNav = isHomeScope && homeNavItems.length === 0;
  const festivalQuery = useQuery({
    queryKey: ["managed-festival", festivalId],
    queryFn: () => getManagedFestival(festivalId as string),
    enabled: Boolean(festivalId),
  });
  const festivalName = festivalQuery.data?.festivalName;
  // 로그인 시점 세션에는 축제별 권한이 없다(계정은 축제마다 역할이 다를 수 있음).
  // 축제 범위 화면에서는 이 축제의 조회 응답에 담긴 role을 우선 쓰고,
  // 축제 범위 밖(메인홈 등)에서만 계정 세션의 role로 대체한다.
  const role = festivalId ? festivalQuery.data?.role : accountRole;

  return (
    <AdminAuthGuard>
      <div className="flex h-dvh min-w-0 flex-col">
        <HeaderNav
          userName={adminName}
          navItems={navItems}
          festivalName={festivalName ?? undefined}
          role={role}
          accountKind={accountKind}
          hideNav={hideNav || hideHomeNav}
        />
        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            className={cn(
              "absolute inset-0",
              fullBleed
                ? "overflow-hidden"
                : "overflow-y-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-[30px]",
            )}
          >
            {/*
              Figma 레이아웃 가이드: Columns 3 / Stretch / Margin 40 / Gutter 24.
              Margin은 위 px-10(=40px)가 이미 담당하고, 여기서는 3-컬럼 그리드 +
              24px(gap-6) 거터만 정의한다. 각 화면 루트는 col-span-1/2/3으로
              몇 컬럼을 쓸지 선언한다 — 폭을 w-2/3 같은 비율로 직접 계산하지 않는다.
            */}
            {fullBleed ? (
              children
            ) : (
              <div className="grid min-w-0 grid-cols-3 gap-6 [&>*]:min-w-0 max-lg:[&>*]:col-span-3">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>
      {/*
        알림은 맥 알림처럼 상단바 바로 아래 오른쪽 위에 뜬다. 기본값으로 두면
        상단바에 걸쳐 가리므로, HeaderNav가 알려 주는 --console-topbar-height만큼 내린다.
      */}
      <Toaster
        position="top-right"
        offset={{ top: "calc(var(--console-topbar-height, 72px) + 16px)", right: "32px" }}
        mobileOffset={{ top: "calc(var(--console-topbar-height, 72px) + 12px)", right: "16px" }}
      />
    </AdminAuthGuard>
  );
}
