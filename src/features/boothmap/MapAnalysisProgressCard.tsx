"use client";

import { cn } from "@/lib/utils";
import type { MapAnalysisState } from "./useMapAnalysis";

/** 밀리초를 "3분 12초" 형태로 바꾼다. 1분 미만이면 초만 보여준다. */
function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

interface AnalysisNotice {
  tone: "progress" | "success" | "error";
  title: string;
  description: string;
}

/**
 * 분석 상태를 화면 문구로 옮긴다. 작업이 없으면(좌표 전용 지도) 아무것도 보여주지 않는다 —
 * 그게 에러가 아니라 정상 상태다.
 */
function toNotice({ status, isTimedOut, elapsedMs }: MapAnalysisState) {
  if (!status) return null;

  if (isTimedOut) {
    return {
      tone: "error",
      title: "분석이 예상보다 오래 걸리고 있습니다",
      description:
        "잠시 후 화면을 새로고침해 결과를 확인해 주세요. 계속 진행 중이면 배치도를 다시 올려 주세요.",
    } satisfies AnalysisNotice;
  }

  switch (status.status) {
    case "PENDING":
      return {
        tone: "progress",
        title: "분석 대기 중",
        description: "잠시 후 AI가 배치도를 읽기 시작합니다.",
      } satisfies AnalysisNotice;
    case "PROCESSING":
      return {
        tone: "progress",
        title: "AI가 배치도를 읽고 있어요",
        description: `경과 ${formatElapsed(elapsedMs)} · 분석이 끝날 때까지 편집과 저장은 잠시 막힙니다.`,
      } satisfies AnalysisNotice;
    case "COMPLETED":
      return {
        tone: "success",
        title: `부스 후보 ${status.acceptedCount}개를 찾았습니다`,
        description:
          status.rejectedCount > 0
            ? `읽지 못한 ${status.rejectedCount}개는 제외했습니다. 위치와 이름을 확인해 주세요.`
            : "위치와 이름을 확인한 뒤 저장해 주세요.",
      } satisfies AnalysisNotice;
    case "FAILED":
      return {
        tone: "error",
        title: "배치도 분석에 실패했습니다",
        description: [status.failureCode, status.failureMessage]
          .filter(Boolean)
          .concat("배치도를 다시 올리면 분석을 새로 시작합니다.")
          .join(" · "),
      } satisfies AnalysisNotice;
    case "CANCELLED":
      return {
        tone: "error",
        title: "분석이 취소되었습니다",
        description: "다른 배치도로 교체되었거나 지도가 삭제되어 취소되었습니다.",
      } satisfies AnalysisNotice;
    default:
      return null;
  }
}

const TONE_CLASS = {
  progress: "border-primary/40 bg-primary/5",
  success: "border-zinc-300 bg-white",
  error: "border-error/40 bg-error/5",
} as const;

/** 배치도 AI 분석 진행 상황을 지도 위에 띄운다. 진행 중일 때만 스피너를 함께 보여준다. */
export function MapAnalysisProgressCard({
  analysis,
  className,
}: {
  analysis: MapAnalysisState;
  className?: string;
}) {
  const notice = toNotice(analysis);
  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "w-80 rounded-lg border px-5 py-4 shadow-md",
        TONE_CLASS[notice.tone],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {notice.tone === "progress" ? (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : null}
        <p className="body-small-bold text-zinc-950">{notice.title}</p>
      </div>
      <p className="body-caption mt-1 text-zinc-500">{notice.description}</p>
    </div>
  );
}
