"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { requestPasswordReset } from "./api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: () => requestPasswordReset(email) });

  return (
    <AuthCard title="비밀번호 찾기">
      <p className="body-regular mt-8 text-zinc-950">
        가입한 이메일 주소를 입력해 주세요.
        <br />
        비밀번호 재설정 링크를 보내드립니다.
      </p>

      {/* 설계서상 안내 문구와 인풋 사이는 16px, 인풋과 CTA 사이는 24px이다. */}
      <form
        className="mt-4 flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          type="email"
          required
          label="이메일"
          placeholder="이메일 주소"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        {mutation.isSuccess ? (
          <p className="body-small text-primary">입력한 이메일로 재설정 링크를 보냈습니다.</p>
        ) : null}
        {mutation.isError ? (
          <p className="body-small text-error">{getApiErrorMessage(mutation.error)}</p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "보내는 중..." : "보내기"}
        </Button>
      </form>
    </AuthCard>
  );
}
