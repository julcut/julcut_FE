"use client";

import { Cross2Icon, FileIcon, UploadIcon } from "@radix-ui/react-icons";
import { useRef } from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { cn } from "@/lib/utils";

export interface AttachmentFieldProps {
  /** 지금 첨부된 파일. 없으면 첨부 버튼만 보인다. */
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** `<input type="file">`의 accept. 서버가 받는 형식과 맞춰야 한다. */
  accept: string;
  /** 첨부 버튼 문구. 기본값은 "파일 첨부하기". */
  label?: string;
  /** 버튼 아래에 붙는 보조 설명. 허용 형식·용량 안내에 쓴다. */
  description?: string;
  /** 파일이 규격에 맞지 않을 때 보여줄 메시지. */
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/** 바이트를 사람이 읽는 크기 문자열로 바꾼다. */
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** MIME 타입에서 확장자만 뽑아 대문자로 보여준다. 없으면 파일명 확장자로 대체한다. */
function formatFileKind(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType) return fromType.toUpperCase();
  const fromName = file.name.split(".").pop();
  return fromName ? fromName.toUpperCase() : "파일";
}

/**
 * 파일 하나를 첨부하고 이름·크기를 확인한 뒤 지울 수 있는 입력 칸.
 *
 * 화면설계서 "축제부스지도 첨부"(ADD01 2-3)의 첨부 컴포넌트다 — 첨부 전에는 버튼만,
 * 첨부 후에는 버튼 아래에 파일 카드(아이콘 · 이름 · 크기·형식 · 삭제)를 함께 보여준다.
 */
export function AttachmentField({
  file,
  onSelect,
  onRemove,
  accept,
  label = "파일 첨부하기",
  description,
  error,
  disabled = false,
  className,
}: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onSelect(selected);
          // 같은 파일을 다시 골라도 change가 뜨도록 값을 비운다.
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        icon={<UploadIcon />}
        disabled={disabled}
        className="w-full"
        onClick={() => inputRef.current?.click()}
      >
        {file ? "다른 파일 첨부하기" : label}
      </Button>

      {file ? (
        <div className="flex w-fit max-w-full items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950">
            <FileIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="body-small truncate text-zinc-950">{file.name}</span>
            <span className="body-caption text-zinc-500">
              {formatFileSize(file.size)} · {formatFileKind(file)}
            </span>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            icon={<Cross2Icon />}
            aria-label={`${file.name} 첨부 취소`}
            disabled={disabled}
            className="ml-1 text-zinc-500"
            onClick={onRemove}
          />
        </div>
      ) : null}

      {error ? <p className="body-caption text-error">{error}</p> : null}
      {!error && description ? <p className="body-caption text-zinc-500">{description}</p> : null}
    </div>
  );
}
