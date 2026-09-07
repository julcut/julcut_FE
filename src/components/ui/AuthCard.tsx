import type { ReactNode } from "react";

export interface AuthCardProps {
  title: string;
  children: ReactNode;
}

/**
 * 로그인/회원가입/비밀번호 찾기·재설정 화면에서 공통으로 쓰는
 * 480px 너비의 흰색 카드 + 중앙 정렬 타이틀 뼈대.
 *
 * 설계서는 카드 헤더(타이틀)와 바디의 여백을 다르게 준다 —
 * 헤더 상단은 24px, 바디는 32px. 그래서 상단 패딩만 24px로 따로 잡는다.
 */
export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="w-[480px] max-w-full rounded-2xl bg-white p-5 pt-6 sm:p-8 sm:pt-6">
      <h1 className="heading-regular text-center text-zinc-950">{title}</h1>
      {children}
    </div>
  );
}
