"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 기본값: "삭제하시겠습니까?" */
  title?: string;
  description?: string;
  /** 기본값: "취소" */
  cancelLabel?: string;
  /** 기본값: "삭제" */
  confirmLabel?: string;
  /** 확인 버튼 스타일. 기본값은 "destructive"(삭제류), 등록/저장류 확인에는 "primary"를 전달한다. */
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  confirmPending?: boolean;
  /** 모달 본체에 덧붙일 클래스. 모바일 화면처럼 기본 480px 폭이 맞지 않을 때 사용한다. */
  className?: string;
  /** 딤 오버레이에 덧붙일 클래스. 기본값은 콘솔 상단바 아래만 덮는 위치다. */
  overlayClassName?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "삭제하시겠습니까?",
  description,
  cancelLabel = "취소",
  confirmLabel = "삭제",
  confirmVariant = "destructive",
  onConfirm,
  confirmPending = false,
  className,
  overlayClassName,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn("fixed inset-x-0 top-[118px] bottom-0 z-30 bg-dimmed", overlayClassName)}
        />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-30 w-[480px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-8",
            className,
          )}
        >
          <div className="flex h-14 items-center justify-end">
            <Dialog.Close asChild>
              <button type="button" aria-label="닫기" className="text-zinc-950">
                <Cross2Icon className="size-6" />
              </button>
            </Dialog.Close>
          </div>

          <div>
            <Dialog.Title className="heading-regular text-center text-zinc-950">
              {title}
            </Dialog.Title>

            {description ? (
              <Dialog.Description className="body-regular mt-3 text-center text-zinc-950">
                {description}
              </Dialog.Description>
            ) : null}

            <div className="mt-8 flex gap-3">
              <Dialog.Close asChild>
                <Button variant="outline" size="lg" className="flex-1">
                  {cancelLabel}
                </Button>
              </Dialog.Close>
              <Button
                variant={confirmVariant}
                size="lg"
                className="flex-1"
                disabled={confirmPending}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
