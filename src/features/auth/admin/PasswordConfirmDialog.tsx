"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface PasswordConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  email: string;
  pending?: boolean;
  errorMessage?: string;
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  email,
  pending = false,
  errorMessage,
}: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !pending) {
      setPassword("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-x-0 top-[118px] bottom-0 z-30 bg-dimmed" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-30 w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 sm:p-8">
          <div className="flex h-14 items-center justify-end">
            <Dialog.Close asChild>
              <button type="button" aria-label="닫기" className="text-zinc-950" disabled={pending}>
                <Cross2Icon className="size-6" />
              </button>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onConfirm(password);
            }}
          >
            <Dialog.Title className="heading-regular text-center text-zinc-950">
              비밀번호 재확인
            </Dialog.Title>

            <div className="mt-8 flex flex-col gap-5">
              <Input type="email" label="이메일" disabled value={email} />
              <Input
                type="password"
                required
                label="비밀번호"
                placeholder="비밀번호"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                errorText={errorMessage}
              />
            </div>

            <div className="mt-8">
              <Button type="submit" size="lg" className="w-full" disabled={!password || pending}>
                {pending ? "확인 중..." : "확인하기"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
