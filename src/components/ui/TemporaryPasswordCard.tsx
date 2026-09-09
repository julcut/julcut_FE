"use client";

import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./Button";

export interface TemporaryPasswordCardProps {
  /** 카드 맨 위에 보여줄 안내 문구. 예: "홍길동(hong@a.com) 계정이 생성되었습니다." */
  title: string;
  /** 생성 응답에서만 내려오는 1회성 임시 비밀번호. */
  temporaryPassword: string;
  /** 비밀번호 아래 경고 문구. */
  warning: string;
  /** 경고 문구 아래 덧붙일 안내(예: 로그인 가능 기간). 필요한 화면에서만 전달한다. */
  note?: string;
}

/**
 * 계정 생성 응답으로만 내려오는 임시 비밀번호를 보여주고 복사할 수 있게 하는 카드.
 * 다시 조회할 수 없는 값이라 화면에서 절대 버리면 안 된다.
 */
export function TemporaryPasswordCard({
  title,
  temporaryPassword,
  warning,
  note,
}: TemporaryPasswordCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      toast.success("임시 비밀번호를 복사했습니다.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다. 비밀번호를 직접 선택해 복사해 주세요.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 px-4 py-3">
      <p className="body-small-bold text-zinc-950">{title}</p>
      <div className="flex items-center gap-2">
        <p className="body-small min-w-0 wrap-anywhere text-zinc-950">
          임시 비밀번호: <span className="font-mono">{temporaryPassword}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          icon={copied ? <CheckIcon /> : <CopyIcon />}
          onClick={handleCopy}
        >
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <p className="body-caption text-zinc-500">{warning}</p>
      {note ? <p className="body-caption text-zinc-950">{note}</p> : null}
    </div>
  );
}
