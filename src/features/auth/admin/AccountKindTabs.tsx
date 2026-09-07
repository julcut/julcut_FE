"use client";

import { Button } from "@/components/ui/Button";
import type { AccountKind } from "./types";

const ACCOUNT_KINDS: AccountKind[] = ["GOVERNMENT", "CONTRACTOR"];

const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  GOVERNMENT: "공무원",
  CONTRACTOR: "일반",
};

export interface AccountKindTabsProps {
  value: AccountKind;
  onChange: (accountKind: AccountKind) => void;
}

/**
 * 로그인(AUTH01)·회원가입(AUTH02)에서 공통으로 쓰는 계정 종류 탭.
 *
 * 설계서 스펙: zinc-100 트랙(모서리 각짐) + 4px 패딩, 탭 두 칸은 간격 없이
 * 절반씩 차지한다. 선택된 탭만 흰 배경 + zinc-950 텍스트이고, 선택되지 않은
 * 탭은 zinc-400이다. 선택 상태에서도 글자를 굵게 하거나 primary 색을 쓰지
 * 않는다.
 */
export function AccountKindTabs({ value, onChange }: AccountKindTabsProps) {
  return (
    <div className="bg-zinc-100 p-1">
      <div className="grid grid-cols-2">
        {ACCOUNT_KINDS.map((accountKind) => (
          <Button
            key={accountKind}
            type="button"
            variant="ghost"
            aria-pressed={value === accountKind}
            className={
              value === accountKind ? "bg-white text-zinc-950 hover:bg-white" : "text-zinc-400"
            }
            onClick={() => onChange(accountKind)}
          >
            {ACCOUNT_KIND_LABEL[accountKind]}
          </Button>
        ))}
      </div>
    </div>
  );
}
