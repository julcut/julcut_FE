"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { AccountKindTabs } from "./AccountKindTabs";
import { loginAdmin } from "./api";
import type { AccountKind } from "./types";

/**
 * `Button`의 ghost + size="sm" 스타일을 그대로 옮긴 값 — 설계서상 "비밀번호
 * 찾기"는 ghost 버튼이지만 실제 동작은 페이지 이동이라 `<button>` 대신
 * `Link`에 직접 적용한다.
 */
const GHOST_LINK_CLASSES =
  "inline-flex items-center justify-center gap-1 rounded-md px-4 py-1 body-small whitespace-nowrap text-zinc-950 transition-colors hover:bg-zinc-100";

export function LoginForm({ sessionExpired = false }: { sessionExpired?: boolean }) {
  const router = useRouter();
  const setSession = useAdminAuthStore((state) => state.setSession);
  const [accountKind, setAccountKind] = useState<AccountKind>("GOVERNMENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: loginAdmin,
    onSuccess: (data) => {
      setSession(data.expiresIn, data.admin);
      router.push("/console");
    },
  });

  /** 계정 종류를 바꾸면 앞서 입력한 값은 다른 계정의 것이므로 비운다. */
  const selectAccountKind = (kind: AccountKind) => {
    if (kind === accountKind) return;
    setAccountKind(kind);
    setEmail("");
    setPassword("");
    loginMutation.reset();
  };

  return (
    <AuthCard title="로그인">
      {sessionExpired ? (
        <p role="status" className="body-small mt-4 text-center text-zinc-600">
          로그인이 만료되었습니다. 다시 로그인해 주세요.
        </p>
      ) : null}
      {/* 설계서상 입력 영역 안쪽 간격은 20px, 입력 영역과 CTA 사이는 24px,
          CTA와 ghost 버튼 사이는 16px이다. */}
      <form
        className="mt-8 flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          loginMutation.mutate({ email, password });
        }}
      >
        <div className="flex flex-col gap-5">
          <AccountKindTabs value={accountKind} onChange={selectAccountKind} />

          <Input
            type="email"
            required
            label="이메일"
            placeholder={accountKind === "GOVERNMENT" ? "공무원 이메일" : "이메일"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            type="password"
            required
            label="비밀번호"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {loginMutation.isError && (
          <p className="body-small text-error">{getApiErrorMessage(loginMutation.error)}</p>
        )}

        <div className="flex flex-col gap-4">
          <Button type="submit" size="lg" disabled={loginMutation.isPending} className="w-full">
            {loginMutation.isPending ? "로그인 중..." : "로그인"}
          </Button>

          <div className="mx-auto flex items-center">
            <Link href="/forgot-password" className={GHOST_LINK_CLASSES}>
              비밀번호 찾기
            </Link>
            <span aria-hidden className="h-3 w-px shrink-0 bg-zinc-200" />
            <Link href="/staff/login" className={GHOST_LINK_CLASSES}>
              현장 스태프 로그인
            </Link>
          </div>
        </div>
      </form>
    </AuthCard>
  );
}
