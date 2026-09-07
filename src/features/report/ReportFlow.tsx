"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
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
  const generationStatus = statusQuery.data?.generationStatus;
  const isGenerating = generationStatus === "PENDING" || generationStatus === "PROCESSING";
  const showForm = generationStatus !== "COMPLETED" && !isGenerating;
  const visitorModeUnset = visitorsQuery.data?.visitorCountInputMode === "UNSET";

  useEffect(() => {
    // 집계 방식 미설정 안내 화면에서는 축제 정보로 빠져나가야 하므로 상단 탭을 남겨둔다.
    setHideNav((showForm && !visitorModeUnset) || isGenerating);
    return () => setHideNav(false);
  }, [isGenerating, setHideNav, showForm, visitorModeUnset]);

  const submitMutation = useMutation({
    mutationFn: async (value: number[] | number) => {
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["festival-visitor-counts", festivalId] }),
        queryClient.invalidateQueries({ queryKey: ["festival-report-status", festivalId] }),
      ]);
    },
  });

  if (visitorsQuery.isLoading || statusQuery.isLoading)
    return <p className="body-regular col-span-3 text-zinc-500">불러오는 중...</p>;
  const error = visitorsQuery.error ?? statusQuery.error ?? submitMutation.error;
  if (error) return <p className="body-small col-span-3 text-error">{getApiErrorMessage(error)}</p>;

  if (showForm && visitorsQuery.data) {
    if (visitorsQuery.data.visitorCountInputMode === "UNSET") {
      return (
        <div className="col-span-3 flex flex-col items-start gap-4 rounded-lg border border-zinc-300 bg-white px-8 py-6">
          <p className="body-large-bold text-zinc-950">방문 인원 집계 방식이 설정되지 않았습니다</p>
          <p className="body-small text-zinc-500">
            축제 정보에서 방문 인원 집계 방식(일자별/총합)을 먼저 선택해야 결과 리포트를 만들 수
            있습니다.
          </p>
          <Button type="button" onClick={() => router.push(`/console/festivals/${festivalId}`)}>
            축제 정보 수정하러 가기
          </Button>
        </div>
      );
    }
    return (
      <div className="fixed inset-x-0 top-[72px] bottom-0 z-10 flex items-center justify-center bg-dimmed p-8">
        <VisitorCountForm
          days={visitorsQuery.data.days}
          mode={visitorsQuery.data.visitorCountInputMode}
          initialTotal={visitorsQuery.data.totalOverrideVisitorCount}
          isPending={submitMutation.isPending}
          onSubmit={(counts) => submitMutation.mutate(counts)}
        />
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
      <ReportPanel festivalId={festivalId} />
    </div>
  );
}
