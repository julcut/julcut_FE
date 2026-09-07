"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil1Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { MapMetric } from "@/components/map/MapMetric";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { getCurrentMap } from "@/features/boothmap/api";
import { primaryFestivalCenter } from "@/features/boothmap/mapCenter";
import { getManagedFestival } from "@/features/festivals/api";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useConsoleUiStore } from "@/store/consoleUiStore";
import {
  getFestivalCongestion,
  getFestivalDashboard,
  getFestivalOperationSuggestions,
  getFestivalQueues,
} from "./api";
import { AiSuggestionPanel } from "./AiSuggestionPanel";
import { BoothMapView } from "./BoothMapView";
import { BoothTreeSidebar } from "./BoothTreeSidebar";
import { DashboardStatsBar } from "./DashboardStatsBar";
import type { Booth, BoothZone } from "./types";

export function DashboardPanel({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [zoomStep, setZoomStep] = useState(0);
  const [boothListOpen, setBoothListOpen] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const setFullBleed = useConsoleUiStore((state) => state.setFullBleed);
  const festivalQuery = useQuery({
    queryKey: ["managed-festival", festivalId],
    queryFn: () => getManagedFestival(festivalId),
  });
  const mapCenter = useMemo(
    () => primaryFestivalCenter(festivalQuery.data?.locations),
    [festivalQuery.data?.locations],
  );
  const mapDataQuery = useQuery({
    queryKey: ["dashboard-map", festivalId, festivalQuery.data?.role],
    enabled: festivalQuery.isSuccess,
    queryFn: () => getCurrentMap(festivalId),
    // 지도 미등록 또는 좌표 누락은 재시도로 해결되지 않는다.
    retry: false,
  });
  const dashboardQuery = useQuery({
    queryKey: ["festival-dashboard", festivalId],
    queryFn: () => getFestivalDashboard(festivalId),
  });
  const congestionQuery = useQuery({
    queryKey: ["festival-congestion", festivalId],
    queryFn: () => getFestivalCongestion(festivalId),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["festival-operation-suggestions", festivalId],
    queryFn: () => getFestivalOperationSuggestions(festivalId),
  });
  const queuesQuery = useQuery({
    queryKey: ["festival-queues", festivalId],
    queryFn: () => getFestivalQueues(festivalId),
  });
  const mapBooths = useMemo((): Booth[] => {
    const dashboardBooths = dashboardQuery.data?.booths ?? [];
    const zoneIdByNodeId = new Map<string, string>();
    (dashboardQuery.data?.zones ?? []).forEach((zone) =>
      zone.boothNodeIds.forEach((nodeId) => zoneIdByNodeId.set(nodeId, zone.zoneId)),
    );
    const congestionByBoothId = new Map(
      (congestionQuery.data?.booths ?? []).map((booth) => [booth.boothId, booth]),
    );
    const queueByBoothId = new Map(
      (queuesQuery.data?.queues ?? []).map((queue) => [queue.boothId, queue]),
    );
    return dashboardBooths.map((dashboardBooth) => {
      const congestion = congestionByBoothId.get(dashboardBooth.boothId);
      const queue = queueByBoothId.get(dashboardBooth.boothId);
      return {
        boothId: String(dashboardBooth.boothId),
        name: dashboardBooth.boothName,
        zoneId: zoneIdByNodeId.get(dashboardBooth.roadmapNodePublicId ?? "") ?? "unassigned",
        lat: dashboardBooth.lat ?? undefined,
        lng: dashboardBooth.lng ?? undefined,
        congestionLevel:
          congestion?.congestionLevel ?? dashboardBooth?.congestionLevel ?? undefined,
        waitMinutes: congestion?.waitMinutes ?? dashboardBooth?.waitMinutes ?? undefined,
        congestionUpdatedAt:
          congestion?.updatedAt ?? dashboardBooth?.congestionUpdatedAt ?? undefined,
        lastQueueUpdater:
          queue?.lastModifierName && queue.lastModifierType
            ? { name: queue.lastModifierName, role: queue.lastModifierType }
            : undefined,
      };
    });
  }, [
    congestionQuery.data?.booths,
    dashboardQuery.data?.booths,
    dashboardQuery.data?.zones,
    queuesQuery.data?.queues,
  ]);
  const mapZones = useMemo((): BoothZone[] => {
    const zones = (dashboardQuery.data?.zones ?? [])
      .map((zone) => ({
        zoneId: zone.zoneId,
        name: zone.name,
        booths: mapBooths.filter((booth) => booth.zoneId === zone.zoneId),
      }))
      .filter((zone) => zone.booths.length > 0);
    const unassigned = mapBooths.filter((booth) => booth.zoneId === "unassigned");
    if (unassigned.length > 0) {
      zones.push({ zoneId: "unassigned", name: "구역 미지정", booths: unassigned });
    }
    return zones;
  }, [dashboardQuery.data?.zones, mapBooths]);
  const dashboardMapCenter = mapDataQuery.data?.center ?? mapCenter;
  const suggestions = (suggestionsQuery.data?.suggestions ?? [])
    .filter((suggestion) => !dismissedSuggestionIds.includes(suggestion.suggestionId))
    .map((suggestion) => ({ ...suggestion, id: suggestion.suggestionId }));

  // 지도가 네비바 바로 아래부터 화면 전체를 채우도록 콘솔 콘텐츠 영역의 여백을 없앤다(디자인 스펙).
  useEffect(() => {
    setFullBleed(true);
    return () => setFullBleed(false);
  }, [setFullBleed]);

  if (
    festivalQuery.isLoading ||
    mapDataQuery.isLoading ||
    dashboardQuery.isLoading ||
    congestionQuery.isLoading ||
    suggestionsQuery.isLoading ||
    queuesQuery.isLoading
  ) {
    return <DashboardState message="대시보드를 불러오는 중..." />;
  }

  // 지도를 못 불러와도 방문자수 등 운영 지표는 보여줘야 하므로 지도 실패는 화면 전체를 막지 않는다.
  const queryError =
    festivalQuery.error ??
    dashboardQuery.error ??
    congestionQuery.error ??
    suggestionsQuery.error ??
    queuesQuery.error;
  if (queryError) {
    return (
      <DashboardState
        error
        message={getApiErrorMessage(queryError, "대시보드를 불러오지 못했습니다.")}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const canEditMap =
    festivalQuery.data?.role === "FESTIVAL_OWNER" && festivalQuery.data?.festivalStatus === "DRAFT";
  const mapErrorStatus = isAxiosError(mapDataQuery.error)
    ? mapDataQuery.error.response?.status
    : null;
  const mapErrorDescription =
    mapErrorStatus === 403
      ? "축제 배정 권한을 확인하거나 총괄관리자에게 지도 준비를 요청해 주세요."
      : mapErrorStatus === 400
        ? "축제관리에서 주소를 다시 검색해 장소 좌표를 저장해 주세요."
        : "총괄관리자가 축제관리에서 지도 등록 상태와 장소 좌표를 확인해 주세요.";
  const mapErrorMessage = mapDataQuery.isError
    ? getApiErrorMessage(mapDataQuery.error, "부스맵을 불러오지 못했습니다.")
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {dashboardMapCenter ? (
        <BoothMapView
          booths={mapBooths}
          selectedBooth={selectedBooth}
          onSelectBooth={setSelectedBooth}
          zoomStep={zoomStep}
          center={dashboardMapCenter}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 px-8">
          <div className="max-w-md text-center">
            <p className="body-regular-bold text-zinc-950">축제 위치가 등록되지 않았습니다.</p>
            <p className="body-small mt-2 text-zinc-500">
              축제관리에서 주소를 검색해 위도·경도를 저장해 주세요.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-4 z-10 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 lg:inset-x-8 lg:inset-y-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-5">
        <BoothTreeSidebar
          zones={mapZones}
          selectedBoothId={selectedBooth?.boothId}
          onSelectBooth={(booth) => {
            setSelectedBooth(booth);
            setBoothListOpen(false);
          }}
          className={`pointer-events-auto col-start-1 row-start-2 min-h-0 w-full lg:row-span-2 lg:row-start-1 lg:flex lg:w-72 ${boothListOpen ? "flex" : "hidden"}`}
        />

        <div className="col-start-1 row-start-1 flex min-h-0 flex-wrap items-start justify-between gap-3 lg:col-start-2 lg:flex-nowrap lg:justify-end lg:gap-5">
          <Button
            variant="outline"
            className="pointer-events-auto lg:hidden"
            aria-expanded={boothListOpen}
            onClick={() => setBoothListOpen((open) => !open)}
          >
            {boothListOpen ? "부스 목록 닫기" : "부스 목록"}
          </Button>
          <div className="order-3 flex max-h-48 w-full min-w-0 flex-col gap-3 overflow-y-auto lg:order-none lg:max-h-full lg:w-80 lg:shrink lg:gap-4">
            {mapErrorMessage ? (
              <div className="pointer-events-auto rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md">
                <p className="body-small-bold text-zinc-950">{mapErrorMessage}</p>
                <p className="body-caption mt-1 text-zinc-500">{mapErrorDescription}</p>
              </div>
            ) : null}
            <AiSuggestionPanel
              suggestions={suggestions}
              onDismiss={(id) => setDismissedSuggestionIds((current) => [...current, id])}
              className="pointer-events-auto min-h-0 w-full overflow-y-auto"
            />
          </div>
          <div className="ml-auto shrink-0">
            <Button
              variant="primary"
              icon={<Pencil1Icon />}
              className="pointer-events-auto shrink-0 shadow-md"
              disabled={!canEditMap}
              title={
                canEditMap
                  ? undefined
                  : "총괄관리자만 축제 초안 상태에서 부스맵을 수정할 수 있습니다."
              }
              onClick={() => {
                if (canEditMap) router.push(`/console/festivals/${festivalId}/boothmap`);
              }}
            >
              {canEditMap ? "수정하기" : "수정 불가"}
            </Button>
          </div>
        </div>

        <div className="relative col-start-1 row-start-3 flex min-w-0 items-end gap-3 lg:col-start-2 lg:row-start-2 lg:gap-5">
          <div className="pointer-events-auto max-h-40 min-w-0 flex-1 overflow-y-auto lg:max-h-none">
            {selectedBooth ? (
              <DashboardStatsBar selectedBooth={selectedBooth} />
            ) : dashboard?.dataAvailable ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg lg:gap-6 border border-zinc-200 bg-white px-5 py-4 shadow-md">
                <MapMetric
                  value={
                    dashboard.currentVisitorCount === null
                      ? "데이터 없음"
                      : `${dashboard.currentVisitorCount.toLocaleString()} 명`
                  }
                  valueClassName="body-regular-bold"
                  label="현재 방문자수"
                  description="백엔드에서 집계한 현재 방문자수입니다."
                />
                <MapMetric
                  value={
                    dashboard.activeQueueCount === null
                      ? "데이터 없음"
                      : `${dashboard.activeQueueCount.toLocaleString()} 개`
                  }
                  valueClassName="body-regular-bold"
                  label="활성 대기열"
                  description="현재 활성화된 대기열 수입니다."
                />
                <MapMetric
                  value={
                    dashboard.averageWaitMinutes === null
                      ? "데이터 없음"
                      : `${dashboard.averageWaitMinutes.toLocaleString()} 분`
                  }
                  valueClassName="body-regular-bold"
                  label="평균 대기시간"
                  description="현재 활성 대기열의 평균 대기시간입니다."
                />
                <MapMetric
                  value={dashboard.operatingStatus}
                  valueClassName="body-regular-bold"
                  label="운영 상태"
                  description="백엔드에서 제공하는 현재 운영 상태입니다."
                />
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md">
                <p className="body-small-bold text-zinc-950">
                  아직 연결된 실시간 운영 지표가 없습니다.
                </p>
                <p className="body-caption mt-1 text-zinc-500">
                  지도와 부스 위치만 확인할 수 있습니다.
                </p>
              </div>
            )}
          </div>
          <MapZoomControls
            className="pointer-events-auto absolute right-0 bottom-full mb-6 shrink-0 [&_button]:shadow-md"
            onZoomIn={() => setZoomStep((step) => step - 1)}
            onZoomOut={() => setZoomStep((step) => step + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-50">
      <p className={error ? "body-small text-error" : "body-small text-zinc-500"}>{message}</p>
    </div>
  );
}
