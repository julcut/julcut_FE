"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/Input";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { AccountKindTabs } from "./AccountKindTabs";
import {
  confirmEmailVerification,
  requestEmailVerification,
  signupAdmin,
  signupContractor,
} from "./api";
import type { PolicySlug } from "./policyContent";
import type { AccountKind } from "./types";

type Step = "agree" | "email" | "code" | "profile";

const CODE_TIMER_SECONDS = 5 * 60;

interface AgreementItem {
  key: PolicySlug;
  label: string;
}

const AGREEMENT_ITEMS: AgreementItem[] = [
  { key: "terms", label: "축지법 서비스 이용약관" },
  { key: "privacy", label: "개인정보 수집 및 이용동의" },
  { key: "privacy-outsourcing", label: "개인정보 취급 위탁 동의" },
];

type Agreements = Record<PolicySlug, boolean>;

const INITIAL_AGREEMENTS: Agreements = {
  terms: false,
  privacy: false,
  "privacy-outsourcing": false,
};

interface SignupFormProps {
  initialAccountKind?: AccountKind;
  /** 회원가입이 성공적으로 완료됐을 때 호출된다. */
  onComplete: (accountKind: AccountKind) => void;
}

function formatRemaining(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SignupForm({ initialAccountKind = "GOVERNMENT", onComplete }: SignupFormProps) {
  const [accountKind, setAccountKind] = useState<AccountKind>(initialAccountKind);
  const isGovernment = accountKind === "GOVERNMENT";
  const [step, setStep] = useState<Step>("agree");
  const [agreements, setAgreements] = useState<Agreements>(INITIAL_AGREEMENTS);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [rank, setRank] = useState("");
  const [password, setPassword] = useState("");
  const [remaining, setRemaining] = useState(CODE_TIMER_SECONDS);

  useEffect(() => {
    if (step !== "code" || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((value) => {
        const next = value - 1;
        if (next <= 0) setCode("");
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, remaining]);

  const requestCodeMutation = useMutation({
    mutationFn: () => requestEmailVerification({ email, accountKind }),
    onSuccess: () => {
      setStep("code");
      setRemaining(CODE_TIMER_SECONDS);
    },
  });

  const resendCodeMutation = useMutation({
    mutationFn: () => requestEmailVerification({ email, accountKind }),
    onSuccess: () => setRemaining(CODE_TIMER_SECONDS),
  });

  const confirmCodeMutation = useMutation({
    mutationFn: () => confirmEmailVerification({ email, code }),
    onSuccess: () => setStep("profile"),
  });

  const allAgreed = AGREEMENT_ITEMS.every((item) => agreements[item.key]);

  const toggleAll = (checked: boolean) => {
    setAgreements(
      AGREEMENT_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: checked }), {} as Agreements),
    );
  };

  const signupMutation = useMutation({
    mutationFn: () =>
      isGovernment
        ? signupAdmin({
            email,
            name,
            organization,
            rank,
            password,
            passwordConfirm: password,
          })
        : signupContractor({
            email,
            name,
            companyName: organization,
            password,
            passwordConfirm: password,
          }),
    onSuccess: () => onComplete(accountKind),
  });

  const profileReady = Boolean(name && organization && password && (!isGovernment || rank));

  return (
    <AuthCard title="회원가입">
      {step === "agree" && (
        <div className="mt-8 flex flex-col">
          <AccountKindTabs value={accountKind} onChange={setAccountKind} />

          <label className="mt-6 flex cursor-pointer items-center gap-2 py-4">
            <Checkbox
              checked={allAgreed}
              onCheckedChange={(checked) => toggleAll(checked === true)}
            />
            <span className="body-large-bold text-zinc-950">전체 동의하기</span>
          </label>

          <div className="flex flex-col divide-y divide-zinc-200">
            {AGREEMENT_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={agreements[item.key]}
                    onCheckedChange={(checked) =>
                      setAgreements((prev) => ({ ...prev, [item.key]: checked === true }))
                    }
                  />
                  <span className="body-regular-bold inline-flex items-center gap-1 text-zinc-950">
                    <span className="text-error">필수</span>
                    <span>{item.label}</span>
                  </span>
                </label>
                <Link
                  href={`/policy/${item.key}`}
                  target="_blank"
                  className="body-regular text-zinc-950 underline"
                >
                  보기
                </Link>
              </div>
            ))}
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!allAgreed}
            className="mt-6 w-full"
            onClick={() => setStep("email")}
          >
            다음
          </Button>
        </div>
      )}

      {step === "email" && (
        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            requestCodeMutation.mutate();
          }}
        >
          <Input
            type="email"
            required
            label="이메일"
            placeholder={isGovernment ? "공무원 이메일" : "일반 이메일 주소"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          {requestCodeMutation.isError && (
            <p className="body-small text-error">{getApiErrorMessage(requestCodeMutation.error)}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!email || requestCodeMutation.isPending}
            className="w-full"
          >
            {requestCodeMutation.isPending ? "발송 중..." : "인증요청"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form
          className="mt-8 flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            confirmCodeMutation.mutate();
          }}
        >
          <Input type="email" readOnly label="이메일" value={email} />

          <Input
            type="text"
            required
            inputMode="numeric"
            pattern="^\d{6}$"
            maxLength={6}
            layout="with-button"
            label="인증번호"
            placeholder="인증번호 6자리"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            helperText={
              remaining > 0 ? (
                <>
                  남은 시간 <span className="body-small-bold">{formatRemaining(remaining)}</span>
                </>
              ) : (
                "인증번호가 만료되었습니다."
              )
            }
            helperTextClassName="body-small text-zinc-950"
            button={
              <Button
                type="button"
                disabled={resendCodeMutation.isPending}
                onClick={() => resendCodeMutation.mutate()}
              >
                재전송
              </Button>
            }
          />

          {confirmCodeMutation.isError && (
            <p className="body-small text-error">{getApiErrorMessage(confirmCodeMutation.error)}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={code.length !== 6 || remaining <= 0 || confirmCodeMutation.isPending}
            className="w-full"
          >
            {confirmCodeMutation.isPending ? "확인 중..." : "다음"}
          </Button>
        </form>
      )}

      {step === "profile" && (
        <form
          className="mt-8 flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            signupMutation.mutate();
          }}
        >
          {/* 설계서는 회원정보 단계를 "계정정보"와 "사용자정보" 두 그룹으로
              나누고 그룹 사이만 24px을 띄운다. 그룹 안쪽 간격은 20px이다. */}
          <div className="flex flex-col gap-5">
            <Input type="email" disabled label="이메일" value={email} />
            <Input
              type="password"
              required
              minLength={8}
              maxLength={100}
              label="비밀번호"
              placeholder="비밀번호"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-5">
            <Input
              type="text"
              required
              minLength={2}
              maxLength={100}
              label="이름"
              placeholder="이름"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            {isGovernment ? (
              <div className="flex gap-3">
                <Input
                  type="text"
                  required
                  label="과·팀"
                  placeholder="과·팀"
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                />
                <Input
                  type="text"
                  required
                  label="직급"
                  placeholder="직급"
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                />
              </div>
            ) : (
              <Input
                type="text"
                required
                minLength={2}
                maxLength={255}
                label="업체명"
                placeholder="업체명"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
              />
            )}
          </div>

          {signupMutation.isError && (
            <p className="body-small text-error">{getApiErrorMessage(signupMutation.error)}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!profileReady || signupMutation.isPending}
            className="w-full"
          >
            {signupMutation.isPending ? "가입 중..." : "가입하기"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
