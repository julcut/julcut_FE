"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { AccountKind, AdminRole } from "@/features/auth/admin/types";
import { canCreateFestival } from "@/features/auth/admin/types";

/**
 * 콘솔 상단 네비게이션. 축제 범위·역할에 따라 다른 탭 목록을 가로로 나열한다.
 *
 * 각 아이템은 `Button`의 "ghost" + size="sm" 스타일(선택 시 semibold)을
 * 그대로 재사용하되, `<a>` 안에 `<button>`을 중첩하는 대신 `Link`에
 * 직접 적용한다.
 */
export interface NavItem {
  label: string;
  href: string;
}

export interface NavProps {
  /** 명시적인 nav 아이템 목록을 전달하면 아래 기본 로직을 무시하고 그대로 쓴다. */
  items?: NavItem[];
  /**
   * 축제 범위 기본 아이템의 href를 만들 때 쓰는 현재 축제 id.
   * 이 `Nav`가 축제 범위 라우트 아래에서 렌더링될 때는 `[festivalId]`
   * 라우트 파라미터를 기본값으로 사용하므로, 대부분의 호출부는
   * 명시적으로 전달할 필요가 없다.
   */
  festivalId?: string;
  /** 로그인한 관리자의 현재 축제 역할. 총괄관리자/운영자에 따라 노출되는 탭이 다르다. */
  role?: AdminRole | null;
  /** 계정 종류. 축제 미선택 화면에서 축제등록 노출 여부를 결정한다. */
  accountKind?: AccountKind | null;
}

function buildDefaultItems(
  festivalId: string | undefined,
  role: AdminRole | null | undefined,
  accountKind: AccountKind | null | undefined,
): NavItem[] {
  // 축제를 고르기 전에는 축제별 화면으로 갈 수 없다. 예전에는 여기서
  // /console/festivals/dashboard 같은 주소를 만들었는데, 이 값들이
  // [festivalId] 자리에 들어가 존재하지 않는 축제로 매칭되면서 빈 화면만 남았다.
  if (!festivalId) {
    const items: NavItem[] = [];
    if (canCreateFestival(accountKind)) {
      items.push({ label: "축제등록", href: "/console/festivals/new" });
    }
    items.push({ label: "축제목록", href: "/console" });
    return items;
  }

  const festivalBase = `/console/festivals/${festivalId}`;

  if (role === "SUB_ADMIN") {
    return [
      { label: "대시보드", href: `${festivalBase}/dashboard` },
      { label: "스태프관리", href: `${festivalBase}/staffs` },
    ];
  }

  if (role !== "FESTIVAL_OWNER") return [];

  return [
    { label: "축제관리", href: festivalBase },
    { label: "대시보드", href: `${festivalBase}/dashboard` },
    { label: "운영자관리", href: `${festivalBase}/operators` },
    { label: "스태프관리", href: `${festivalBase}/staffs` },
    // 축제 종료 여부(progressStatus)는 Nav로 전달되지 않아 진행 상태와 무관하게 항상 노출한다.
    // 리포트 화면 자체가 방문 인원 입력·생성 상태를 안내하므로 진입 시점 제한은 두지 않는다.
    { label: "결과리포트", href: `${festivalBase}/report` },
  ];
}

export function Nav({ items, festivalId, role, accountKind }: NavProps) {
  const pathname = usePathname();
  const params = useParams<{ festivalId?: string }>();
  const navItems = items ?? buildDefaultItems(festivalId ?? params?.festivalId, role, accountKind);

  // "축제관리"처럼 다른 탭 href의 상위 경로가 되는 항목이 있을 수 있어,
  // 가장 구체적으로(가장 길게) 일치하는 항목 하나만 active로 표시한다.
  const activeHref = navItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname?.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-zinc-100 bg-white px-4 py-2 lg:px-10">
      {navItems.map((item) => {
        const isActive = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex shrink-0 items-center justify-center rounded-md px-3 py-1 whitespace-nowrap sm:px-4 transition-colors hover:bg-zinc-100 ${
              isActive ? "body-small-bold text-primary" : "body-small text-zinc-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
