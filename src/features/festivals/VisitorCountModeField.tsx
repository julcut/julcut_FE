"use client";

import { Button } from "@/components/ui/Button";
import type { FestivalVisitorCountInputMode } from "./types";

export interface VisitorCountModeFieldProps {
  /** 선택된 집계 방식. 아직 고르지 않았으면 null. */
  value: FestivalVisitorCountInputMode | null;
  onChange: (mode: FestivalVisitorCountInputMode) => void;
  /** 필드 위에 보이는 라벨. 생략하면 라벨 없이 선택 버튼만 렌더링한다. */
  label?: string;
}

interface VisitorCountModeOption {
  value: FestivalVisitorCountInputMode;
  label: string;
  description: string;
}

const VISITOR_COUNT_MODE_OPTIONS: VisitorCountModeOption[] = [
  {
    value: "DAILY",
    label: "일자별 입력",
    description: "축제 기간의 하루하루 방문 인원을 나눠서 입력합니다.",
  },
  {
    value: "TOTAL",
    label: "총합 입력",
    description: "축제 전체 방문 인원을 한 번에 입력합니다.",
  },
];

const DEFAULT_LABEL = "방문 인원 집계 방식";

/**
 * 결과 리포트를 만들 때 쓸 방문 인원 집계 방식(일자별/총합)을 고르는 필드.
 * 축제 등록 화면과 축제 수정 화면이 같은 UI를 공유한다.
 */
export function VisitorCountModeField({ value, onChange, label }: VisitorCountModeFieldProps) {
  const selected = VISITOR_COUNT_MODE_OPTIONS.find((option) => option.value === value);

  return (
    <div className="flex w-full flex-col gap-1">
      {label ? <label className="body-small-bold text-zinc-950">{label}</label> : null}
      <div role="radiogroup" aria-label={label ?? DEFAULT_LABEL} className="flex gap-2">
        {VISITOR_COUNT_MODE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            variant={value === option.value ? "primary" : "outline"}
            className="flex-1"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="body-caption text-zinc-500">
        {selected
          ? selected.description
          : "집계 방식을 정해야 축제 종료 후 결과 리포트를 만들 수 있습니다."}
      </p>
    </div>
  );
}
