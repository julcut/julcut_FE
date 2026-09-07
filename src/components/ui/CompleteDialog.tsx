"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * `Button`의 primary + size="lg" 스타일을 그대로 옮긴 값 — 실제 네비게이션이
 * 필요해 `<button>`을 `<a>` 안에 중첩하지 않고 `Link`에 직접 적용한다.
 */
const ACTION_LINK_CLASSES =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-md bg-primary px-4 py-3 body-large text-white transition-colors hover:bg-primary/90";

export interface CompleteDialogProps {
  title: string;
  description: ReactNode;
  actionLabel: string;
  actionHref: string;
}

/**
 * 닫을 수 없는(항상 열려있는) 완료 안내 모달. 회원가입 완료, 비밀번호 재설정
 * 완료처럼 "결과를 보여주고 다음 화면으로 유도"하는 흐름에서 공통으로 쓴다.
 */
export function CompleteDialog({
  title,
  description,
  actionLabel,
  actionHref,
}: CompleteDialogProps) {
  return (
    <Dialog.Root open modal={false}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-x-0 top-[72px] bottom-0 z-30 bg-dimmed" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-30 flex max-h-[calc(100dvh-32px)] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-y-auto rounded-2xl bg-white p-5 sm:p-8">
          <div className="size-[75px] rounded-full bg-zinc-200" />

          <Dialog.Title className="heading-regular mt-2 text-center text-zinc-950">
            {title}
          </Dialog.Title>

          <Dialog.Description className="body-regular mt-4 text-center text-zinc-950">
            {description}
          </Dialog.Description>

          <Link href={actionHref} className={`mt-8 ${ACTION_LINK_CLASSES}`}>
            {actionLabel}
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
