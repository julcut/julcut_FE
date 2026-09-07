"use client";

import { Cross2Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VisitorCountModeField } from "@/features/festivals/VisitorCountModeField";
import type { FestivalVisitorCountInputMode } from "@/features/festivals/types";
import type { FestivalVisitorDay } from "./types";

export interface VisitorCountFormProps {
  /** 백엔드가 반환한 축제 기간별 방문 인원 입력 상태 */
  days: FestivalVisitorDay[];
  /**
   * 축제에 저장된 집계 방식. "UNSET"이면 이 폼 안에서 먼저 총합/일자별을 고른다 —
   * 화면설계서상 집계 방식 선택은 축제 종료 후 결과리포트 첫 진입에서 한다.
   */
  mode: "DAILY" | "TOTAL" | "UNSET";
  initialTotal?: number | null;
  isPending?: boolean;
  /** 집계 방식이 UNSET이었다면 여기서 고른 방식이 함께 넘어온다. */
  onSubmit: (value: number[] | number, mode: FestivalVisitorCountInputMode) => void;
  /**
   * 입력을 포기하고 화면을 벗어날 때 호출된다.
   * 이 폼은 딤 오버레이 + 상단 탭 숨김 상태로 뜨기 때문에,
   * 브라우저 뒤로가기 말고도 빠져나갈 경로가 반드시 있어야 한다.
   */
  onClose?: () => void;
}

export function VisitorCountForm({
  days,
  mode,
  initialTotal,
  isPending,
  onSubmit,
  onClose,
}: VisitorCountFormProps) {
  const [dailyCounts, setDailyCounts] = useState<string[]>(
    days.map((day) => day.visitorCount?.toString() ?? ""),
  );
  const [totalCount, setTotalCount] = useState(initialTotal?.toString() ?? "");
  // 축제에 집계 방식이 저장돼 있으면 그대로 쓰고, UNSET이면 사용자가 고를 때까지 null.
  const [pickedMode, setPickedMode] = useState<FestivalVisitorCountInputMode | null>(
    mode === "UNSET" ? null : mode,
  );
  const editableDayIndexes = days.flatMap((day, index) => (day.inputAllowed ? [index] : []));

  // 백엔드는 지난 일자(일일마감된 일자)만 입력을 허용한다. 아직 마감된 일자가
  // 하나도 없으면 저장할 것이 없으므로 제출을 막는다.
  const dailyValid =
    editableDayIndexes.length > 0 &&
    editableDayIndexes.every((index) => {
      const value = dailyCounts[index];
      return value.trim() !== "" && Number(value) >= 0;
    });
  const dailyTotal = dailyCounts.reduce((sum, value) => sum + (Number(value) || 0), 0);

  function numbersOnly(value: string) {
    return value.replace(/\D/g, "");
  }

  function handleSubmit() {
    if (!pickedMode) return;
    if (pickedMode === "TOTAL") {
      if (totalCount.trim() === "") return;
      onSubmit(Number(totalCount), pickedMode);
      return;
    }
    if (dailyValid) onSubmit(dailyCounts.map(Number), pickedMode);
  }

  const valid = !pickedMode
    ? false
    : pickedMode === "TOTAL"
      ? totalCount.trim() !== ""
      : dailyValid;

  return (
    <div className="w-[480px] max-w-full overflow-hidden rounded-2xl border border-zinc-300 bg-white">
      <div className="flex items-center gap-1.5 px-5 py-4 sm:px-8">
        {/* 좌우 균형을 맞추려 닫기 버튼과 같은 폭의 자리를 왼쪽에 비워 둔다. */}
        <span aria-hidden className="size-8 shrink-0" />
        <div className="flex flex-1 items-center justify-center gap-1.5">
          <h2 className="heading-small text-center text-zinc-950">축제 방문 인원</h2>
          <Tooltip>
            <TooltipTrigger aria-label="도움말">
              <InfoCircledIcon className="size-4 text-zinc-400" />
            </TooltipTrigger>
            <TooltipContent>방문인원을 입력하면 축제성과를 분석할 수 있어요.</TooltipContent>
          </Tooltip>
        </div>
        {onClose ? (
          <IconButton aria-label="닫기" variant="ghost" icon={<Cross2Icon />} onClick={onClose} />
        ) : (
          <span aria-hidden className="size-8 shrink-0" />
        )}
      </div>

      <div className="flex flex-col gap-6 border-t border-zinc-200 p-5 sm:p-8">
        <div className="flex flex-col gap-5">
          {mode === "UNSET" ? (
            <VisitorCountModeField
              label="방문 인원 집계 방식"
              value={pickedMode}
              onChange={setPickedMode}
            />
          ) : null}
          {!pickedMode ? null : pickedMode === "TOTAL" ? (
            <Input
              label="총 방문객"
              inputMode="numeric"
              placeholder="전체 방문 인원을 입력해 주세요"
              value={totalCount ? Number(totalCount).toLocaleString() : ""}
              onChange={(event) => setTotalCount(numbersOnly(event.target.value))}
            />
          ) : (
            dailyCounts.map((value, index) => (
              <Input
                key={days[index].visitDate}
                label={`${days[index].dayIndex}일차`}
                disabled={!days[index].inputAllowed}
                helperText={days[index].inputAllowed ? undefined : "마감 후 입력할 수 있어요"}
                inputMode="numeric"
                placeholder="방문인원을 입력해 주세요"
                value={value ? Number(value).toLocaleString() : ""}
                onChange={(event) => {
                  const next = [...dailyCounts];
                  next[index] = numbersOnly(event.target.value);
                  setDailyCounts(next);
                }}
              />
            ))
          )}
          {pickedMode === "DAILY" ? (
            <Input
              label="총합"
              disabled
              placeholder="자동 계산"
              value={dailyValid ? dailyTotal.toLocaleString() : ""}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!valid || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "저장 중..." : "입력하기"}
          </Button>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full"
              disabled={isPending}
              onClick={onClose}
            >
              나중에 입력
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
