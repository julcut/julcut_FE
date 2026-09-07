"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginStaff } from "@/features/auth/staff/api";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useStaffAuthStore } from "@/store/staffAuthStore";

export interface StaffLoginFormProps {
  /** 초대 링크(`?festivalId=`)로 전달받은 담당 축제 ID. 없으면 로그인할 수 없다. */
  festivalId?: string;
  /** 세션 만료로 되돌아온 경우 안내 문구를 띄운다. */
  sessionExpired?: boolean;
}

export function StaffLoginForm({ festivalId, sessionExpired = false }: StaffLoginFormProps) {
  const router = useRouter();
  const setSession = useStaffAuthStore((state) => state.setSession);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [inviteError, setInviteError] = useState("");

  const loginMutation = useMutation({
    mutationFn: loginStaff,
    onSuccess: (data) => {
      setSession({
        staffId: data.staffId,
        festivalId: data.festivalId,
        loginId: data.loginId,
        name: data.name,
      });
      router.push("/staff/dashboard");
    },
  });

  const errorMessage =
    inviteError || (loginMutation.isError ? getApiErrorMessage(loginMutation.error) : undefined);

  return (
    <main className="bg-dimmed flex flex-1 flex-col justify-center px-5 py-8">
      {/* 화면설계서 AUTH01: 헤더 타이틀이 붙은 카드 안에 아이디·비밀번호 폼과 CTA를 담는다. */}
      <div className="w-full rounded-2xl bg-white">
        <div className="px-5 pt-4">
          <h1 className="heading-regular text-zinc-950">로그인</h1>
          {sessionExpired ? (
            <p role="status" className="body-small mt-2 text-zinc-950">
              로그인이 만료되었습니다. 다시 로그인해 주세요.
            </p>
          ) : null}
        </div>

        <form
          className="flex flex-col gap-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedFestivalId = festivalId?.trim();
            if (!trimmedFestivalId) {
              setInviteError("축제 운영자가 전달한 초대 링크로 접속해주세요.");
              return;
            }
            setInviteError("");
            loginMutation.mutate({
              festivalId: trimmedFestivalId,
              loginId: loginId.trim(),
              password,
            });
          }}
        >
          <Input
            label="아이디"
            type="text"
            required
            autoComplete="username"
            placeholder="아이디"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
          />
          <Input
            label="비밀번호"
            type="password"
            required
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errorText={errorMessage}
          />
          <Button
            type="submit"
            size="lg"
            className="mt-1 w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </div>
    </main>
  );
}
