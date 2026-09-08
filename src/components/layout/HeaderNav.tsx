"use client";

import { useEffect, useRef } from "react";
import type { AccountKind, AdminRole } from "@/features/auth/admin/types";
import { Header } from "./Header";
import { Nav, type NavItem } from "./Nav";

/**
 * Header(login variant)와 Nav를 간격 없이 세로로 쌓은 콘솔 상단바.
 * 인증된 콘솔 화면에서 항상 같이 쓰이므로, 호출부에서 `Header`와 `Nav`를
 * 따로 쌓지 않도록 하나의 단위로 묶어서 제공한다.
 */
export interface HeaderNavProps {
  userName?: string;
  navItems?: NavItem[];
  festivalId?: string;
  /** 로고 옆에 표시할 현재 축제명. 축제 범위 화면에서만 전달한다. */
  festivalName?: string;
  role?: AdminRole | null;
  accountKind?: AccountKind | null;
  /** true면 Nav 탭 줄을 숨기고 Header만 보여준다(예: 방문인원 입력/분석 중 화면). */
  hideNav?: boolean;
}

export function HeaderNav({
  userName,
  navItems,
  festivalId,
  festivalName,
  role,
  accountKind,
  hideNav = false,
}: HeaderNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /*
    모달 딤이 상단바를 덮지 않도록, 상단바의 실제 높이를 CSS 변수로 내보낸다.
    네비 표시 여부와 좁은 화면의 줄바꿈까지 반영해야 해서 고정값 대신 측정한다.
  */
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const applyHeight = () => {
      document.documentElement.style.setProperty(
        "--console-topbar-height",
        `${element.getBoundingClientRect().height}px`,
      );
    };
    applyHeight();

    const observer = new ResizeObserver(applyHeight);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--console-topbar-height");
    };
  }, []);

  return (
    <div ref={containerRef} className="flex min-w-0 shrink-0 flex-col">
      <Header
        variant="login"
        href="/console"
        userName={userName}
        festivalName={festivalName}
        role={role}
      />
      {hideNav ? null : (
        <Nav items={navItems} festivalId={festivalId} role={role} accountKind={accountKind} />
      )}
    </div>
  );
}
