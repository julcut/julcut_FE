"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FestivalVisitorCountInputMode } from "@/features/festivals/types";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useConsoleUiStore } from "@/store/consoleUiStore";
import {
  generateFestivalReport,
  getFestivalReportStatus,
  getFestivalVisitorCounts,
  updateDailyVisitorCount,
  updateTotalVisitorCount,
} from "./api";
import { ReportPanel } from "./ReportPanel";
import { VisitorCountForm } from "./VisitorCountForm";

export function ReportFlow({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setHideNav = useConsoleUiStore((state) => state.setHideNav);
  const visitorsQuery = useQuery({
    queryKey: ["festival-visitor-counts", festivalId],
    queryFn: () => getFestivalVisitorCounts(festivalId),
  });
  const statusQuery = useQuery({
    queryKey: ["festival-report-status", festivalId],
    queryFn: () => getFestivalReportStatus(festivalId),
    refetchInterval: (query) =>
      ["PENDING", "PROCESSING"].includes(query.state.data?.generationStatus ?? "") ? 1500 : false,
  });
  const [reinputRequested, setReinputRequested] = useState(false);
  const generationStatus = statusQuery.data?.generationStatus;
  const isGenerating = generationStatus === "PENDING" || generationStatus === "PROCESSING";
  // FAILED/CANCELLED를 폼 조건에서 빼지 않으면, 생성이 실패했을 때
  // 아무 설명 없이 방문 인원 입력 폼만 다시 떠서 원인을 알 수 없다.
  const isGenerationBroken = generationStatus === "FAILED" || generationStatus === "CANCELLED";
  const showForm =
    !isGenerating && generationStatus !== "COMPLETED" && (!isGenerationBroken || reinputRequested);
  const closeForm = useCallback(() => {
    setReinputRequested(false);
    router.push(`/console/festivals/${festivalId}`);
  }, [festivalId, router]);

  useEffect(() => {
    setHideNav(showForm || isGenerating);
    return () => setHideNav(false);
  }, [isGenerating, setHideNav, showForm]);

  const submitMutation = useMutation({
    // 집계 방식이 UNSET이면 축제 수정 API로 따로 저장하지 않는다 —
    // 백엔드가 첫 입력(일자별/총합)을 받는 순간 그 방식으로 축제를 자동으로 잠근다.
    // 축제 수정 PATCH는 장소 목록까지 전부 다시 보내야 해서 여기서 부를 이유가 없다.
    mutationFn: async ({
      value,
    }: {
      value: number[] | number;
      mode: FestivalVisitorCountInputMode;
    }) => {
      if (typeof value === "number") {
        await updateTotalVisitorCount(festivalId, value);
        await generateFestivalReport(festivalId);
        return;
      }
      const days = visitorsQuery.data?.days ?? [];
      await Promise.all(
        days.flatMap((day, index) =>
          day.inputAllowed
            ? [updateDailyVisitorCount(festivalId, day.visitDate, value[index])]
            : [],
        ),
      );
      const refreshed = await getFestivalVisitorCounts(festivalId);
      if (refreshed.reportReadyToGenerate) {
        await generateFestivalReport(festivalId);
      }
    },
    onSuccess: async () => {
      setReinputRequested(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["festival-visitor-counts", festivalId] }),
        queryClient.invalidateQueries({ queryKey: ["festival-report-status", festivalId] }),
        queryClient.invalidateQueries({ queryKey: ["managed-festival", festivalId] }),
      ]);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => generateFestivalReport(festivalId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["festival-report-status", festivalId] }),
  });

  if (visitorsQuery.isLoading || statusQuery.isLoading)
    return <p className="body-regular col-span-3 text-zinc-500">불러오는 중...</p>;
  const error =
    visitorsQuery.error ?? statusQuery.error ?? submitMutation.error ?? regenerateMutation.error;
  if (error) return <p className="body-small col-span-3 text-error">{getApiErrorMessage(error)}</p>;

  if (showForm && visitorsQuery.data) {
    return (
      <div className="fixed inset-x-0 top-[72px] bottom-0 z-10 flex items-center justify-center overflow-y-auto bg-dimmed p-4 sm:p-8">
        <VisitorCountForm
          days={visitorsQuery.data.days}
          mode={visitorsQuery.data.visitorCountInputMode}
          initialTotal={visitorsQuery.data.totalOverrideVisitorCount}
          isPending={submitMutation.isPending}
          onSubmit={(value, mode) => submitMutation.mutate({ value, mode })}
          onClose={closeForm}
        />
      </div>
    );
  }

  if (isGenerationBroken) {
    const cancelled = generationStatus === "CANCELLED";
    return (
      <div className="col-span-3 flex flex-col items-start gap-4 rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8">
        <p className="body-large-bold text-zinc-950">
          {cancelled ? "결과 분석이 취소되었습니다" : "결과 분석에 실패했습니다"}
        </p>
        <p className="body-small text-zinc-500">
          {statusQuery.data?.progressMessage ??
            (cancelled
              ? "분석이 중간에 중단되어 리포트가 만들어지지 않았습니다. 다시 분석을 시작할 수 있습니다."
              : "입력하신 내용에는 문제가 없습니다. 분석 처리 중 오류가 발생했으니 잠시 후 다시 시도해 주세요.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={regenerateMutation.isPending}
            onClick={() => regenerateMutation.mutate()}
          >
            {regenerateMutation.isPending ? "요청 중..." : "다시 분석하기"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setReinputRequested(true)}>
            방문 인원 다시 입력
          </Button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="fixed inset-x-0 top-[72px] bottom-0 z-10 flex flex-col items-center justify-center gap-4 bg-white">
        <p className="body-regular text-zinc-950">
          {statusQuery.data?.progressMessage ?? "축제 결과를 분석하고 있어요"}
        </p>
        {statusQuery.data?.progressDayIndex ? (
          <p className="body-small text-zinc-500">
            {statusQuery.data.progressDayIndex}일차 분석 중
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="col-span-3">
      <ReportPanel
        festivalId={festivalId}
        previousFestivalId={statusQuery.data?.previousFestivalId ?? null}
      />
    </div>
  );
}
