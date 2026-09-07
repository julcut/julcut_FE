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

export function LoginForm() {
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

  return (
    <AuthCard title="로그인">
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
              onClick={() => setAccountKind("GOVERNMENT")}
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
              onClick={() => setAccountKind("CONTRACTOR")}
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

        <Link href="/forgot-password" className="body-small mx-auto text-zinc-950">
          비밀번호 찾기
        </Link>
      </form>
    </AuthCard>
  );
}
