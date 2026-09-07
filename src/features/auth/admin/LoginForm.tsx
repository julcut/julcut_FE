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
import { loginAdmin } from "./api";
import type { AccountKind } from "./types";

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
      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          loginMutation.mutate({ email, password });
        }}
      >
        <div className="bg-zinc-100 p-1">
          <div className="grid grid-cols-2 gap-1">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={accountKind === "GOVERNMENT"}
              className={
                accountKind === "GOVERNMENT"
                  ? "rounded-none bg-white text-zinc-950 hover:bg-white"
                  : "rounded-none text-zinc-400"
              }
              onClick={() => selectAccountKind("GOVERNMENT")}
            >
              공무원
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={accountKind === "CONTRACTOR"}
              className={
                accountKind === "CONTRACTOR"
                  ? "rounded-none bg-white text-zinc-950 hover:bg-white"
                  : "rounded-none text-zinc-400"
              }
              onClick={() => selectAccountKind("CONTRACTOR")}
            >
              일반
            </Button>
          </div>
        </div>

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

        {loginMutation.isError && (
          <p className="body-small text-error">{getApiErrorMessage(loginMutation.error)}</p>
        )}

        <Button type="submit" size="lg" disabled={loginMutation.isPending} className="w-full">
          {loginMutation.isPending ? "로그인 중..." : "로그인"}
        </Button>

        <div className="mx-auto flex items-center gap-3">
          <Link href="/forgot-password" className="body-small text-zinc-950">
            비밀번호 찾기
          </Link>
          <span aria-hidden className="h-3 w-px bg-zinc-200" />
          <Link href="/staff/login" className="body-small text-zinc-950">
            현장 스태프 로그인
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
