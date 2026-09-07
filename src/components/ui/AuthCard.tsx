import type { ReactNode } from "react";

export interface AuthCardProps {
  title: string;
  children: ReactNode;
}

/**
 * 로그인/회원가입/비밀번호 찾기·재설정 화면에서 공통으로 쓰는
 * 480px 너비의 흰색 카드 + 중앙 정렬 타이틀 뼈대.
 */
export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="w-[480px] max-w-full rounded-2xl bg-white p-5 sm:p-8">
      <h1 className="heading-regular text-center text-zinc-950">{title}</h1>
      {children}
    </div>
  );
}
