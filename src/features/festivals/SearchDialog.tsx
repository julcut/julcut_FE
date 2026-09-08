"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DIALOG_OVERLAY_CLASSES } from "@/components/ui/dialogOverlay";
import { Input } from "@/components/ui/Input";

export type SearchDialogState = "default" | "none" | "result";

export interface SearchDialogResult {
  id: string;
  label: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  helperText: string;
  helperItems?: string[];
  /** 검색 상태 — 검색 전은 "default", 검색했는데 결과가 없으면 "none", 있으면 "result". */
  state: SearchDialogState;
  /** "검색" 버튼 클릭 또는 Enter로 호출된다. */
  onSearch: (value: string) => void;
  searchPending?: boolean;
  results?: SearchDialogResult[];
  onSelectResult: (result: SearchDialogResult) => void;
  noResultText?: string;
  noResultSubtext?: string;
  /** "none"/"result" 상태에서만 노출되는 폴백 버튼 — 검색으로 못 찾은 값을 직접 쓴다. */
  onManualInput: (value: string) => void;
  manualInputLabel?: string;
  /** 직접 입력한 값을 후처리하는 동안(예: 주소 → 좌표 변환) 버튼을 잠근다. */
  manualInputPending?: boolean;
  /** 직접 입력한 값을 쓸 수 없을 때 버튼 아래 뜨는 사유. */
  manualInputError?: string | null;
}

/** 축제 검색/주소 찾기처럼 "제목 + 검색창 + 결과 목록" 구조를 공유하는 모달. */
export function SearchDialog({
  open,
  onOpenChange,
  title,
  placeholder,
  helperText,
  helperItems,
  state,
  onSearch,
  searchPending = false,
  results = [],
  onSelectResult,
  noResultText = "검색 결과가 없습니다.",
  noResultSubtext,
  onManualInput,
  manualInputLabel = "직접 입력",
  manualInputPending = false,
  manualInputError = null,
}: SearchDialogProps) {
  const [value, setValue] = useState("");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setValue("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={DIALOG_OVERLAY_CLASSES} />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-30 w-[480px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 sm:p-8">
          <div className="relative flex items-center justify-center">
            <Dialog.Title className="heading-small text-zinc-950">{title}</Dialog.Title>
            <Dialog.Close aria-label="닫기" className="absolute right-0 text-zinc-950">
              <Cross2Icon className="size-6" />
            </Dialog.Close>
          </div>

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = value.trim();
              if (!trimmed) return;
              onSearch(trimmed);
            }}
          >
            <Input
              autoFocus
              layout="with-button"
              placeholder={placeholder}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              button={
                <Button type="submit" disabled={searchPending}>
                  검색
                </Button>
              }
            />

            {state === "default" ? (
              <div className="mt-2 flex flex-col gap-2 rounded-lg bg-zinc-50 px-4 py-3">
                <p className="body-small-bold text-zinc-950">{helperText}</p>
                {helperItems && helperItems.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {helperItems.map((item) => (
                      <li key={item} className="body-small text-zinc-950">
                        · {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {state === "none" ? (
              <div className="mt-2 flex flex-col gap-2 rounded-md bg-zinc-100 px-4 py-3">
                <p className="body-small-bold text-zinc-950">{noResultText}</p>
                {noResultSubtext ? (
                  <p className="body-small text-zinc-950">{noResultSubtext}</p>
                ) : null}
              </div>
            ) : null}

            {state === "result" ? (
              <ul className="flex max-h-[340px] flex-col divide-y divide-zinc-200 overflow-y-auto">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => onSelectResult(result)}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-zinc-100"
                    >
                      <span className="body-small-bold text-zinc-950">{result.label}</span>
                      {result.description ? (
                        <span className="body-small text-zinc-950">{result.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {state !== "default" ? (
              <div className="mt-2 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  disabled={manualInputPending}
                  onClick={() => onManualInput(value.trim())}
                >
                  {manualInputLabel}
                </Button>
                {manualInputError ? (
                  <p className="body-small text-error">{manualInputError}</p>
                ) : null}
              </div>
            ) : null}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
