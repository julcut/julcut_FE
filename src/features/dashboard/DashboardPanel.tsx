"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil1Icon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { MapMetric } from "@/components/map/MapMetric";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { createCoordinateMap, getCurrentMap, getMapEditor } from "@/features/boothmap/api";
import { nodeToLocalBooth } from "@/features/boothmap/geometryWgs84";
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

function getHttpStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null;
}

export function DashboardPanel({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [zoomStep, setZoomStep] = useState(0);
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
    queryKey: [
      "dashboard-map",
      festivalId,
      festivalQuery.data?.role,
      festivalQuery.data?.festivalStatus,
    ],
    enabled: festivalQuery.isSuccess,
    queryFn: async () => {
      const festival = festivalQuery.data!;
      const canCreateMap =
        festival.role === "FESTIVAL_OWNER" && festival.festivalStatus === "DRAFT";

      let map;
      try {
        map = await getCurrentMap(festivalId);
      } catch (error) {
        const status = getHttpStatus(error);
        // 제2관리자는 맵 생성이 불가하므로 404면 장소 좌표만으로 지도를 표시한다.
        if (status === 404 && !canCreateMap) {
          return { map: null, editor: null };
        }
        if (status === 404 && canCreateMap) {
          map = await createCoordinateMap(festivalId, { mapName: "본행사 배치" });
        } else {
          throw error;
        }
      }

      const editor = await getMapEditor(festivalId, map.mapId);
      return { map, editor };
    },
    retry: (failureCount, error) => {
      const status = getHttpStatus(error);
      return status !== 400 && status !== 403 && status !== 404 && failureCount < 2;
    },
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
    return (mapDataQuery.data?.editor?.nodes ?? [])
      .filter((node) => node.nodeType === "BOOTH")
      .map(nodeToLocalBooth)
      .filter((pin): pin is NonNullable<typeof pin> => pin !== null)
      .map((pin) => {
        const dashboardBooth = dashboardBooths.find(
          (booth) => booth.roadmapNodePublicId === (pin.nodeId ?? pin.id),
        );
        const congestion = dashboardBooth
          ? congestionByBoothId.get(dashboardBooth.boothId)
          : undefined;
        const queue = dashboardBooth ? queueByBoothId.get(dashboardBooth.boothId) : undefined;
        return {
          boothId: String(dashboardBooth?.boothId ?? pin.nodeId ?? pin.id),
          name: dashboardBooth?.boothName ?? pin.name,
          zoneId: zoneIdByNodeId.get(pin.nodeId ?? pin.id) ?? "unassigned",
          lat: pin.lat,
          lng: pin.lng,
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
    mapDataQuery.data?.editor?.nodes,
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
  const dashboardMapCenter =
    mapDataQuery.data?.editor?.center ?? mapDataQuery.data?.map?.center ?? mapCenter;
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
    (festivalQuery.isSuccess && mapDataQuery.isLoading) ||
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
  const isFestivalOwner = festivalQuery.data?.role === "FESTIVAL_OWNER";
  const canEditMap = isFestivalOwner && festivalQuery.data?.festivalStatus === "DRAFT";
  const mapErrorStatus = mapDataQuery.isError ? getHttpStatus(mapDataQuery.error) : null;
  const mapErrorOverlay = (() => {
    if (!mapDataQuery.isError) return null;
    if (mapErrorStatus === 403) {
      return {
        title: "배치 지도 조회 권한이 없습니다.",
        description: "축제 배정 권한을 확인하거나, 총괄관리자에게 지도 준비를 요청해 주세요.",
      };
    }
    if (mapErrorStatus === 400) {
      return {
        title: getApiErrorMessage(mapDataQuery.error, "부스맵을 불러오지 못했습니다."),
        description:
          "축제 장소에 위도·경도가 없으면 부스맵을 만들 수 없습니다. 축제관리에서 주소를 다시 검색해 좌표를 저장해 주세요.",
      };
    }
    return {
      title: getApiErrorMessage(mapDataQuery.error, "부스맵을 불러오지 못했습니다."),
      description: "잠시 후 다시 시도해 주세요.",
    };
  })();

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

      {mapErrorOverlay ? (
        <div className="absolute top-10 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md">
          <p className="body-small-bold text-zinc-950">{mapErrorOverlay.title}</p>
          <p className="body-caption mt-1 text-zinc-500">{mapErrorOverlay.description}</p>
        </div>
      ) : null}

      <BoothTreeSidebar
        zones={mapZones}
        selectedBoothId={selectedBooth?.boothId}
        onSelectBooth={setSelectedBooth}
        className="absolute top-10 bottom-10 left-8 w-72"
      />

      <AiSuggestionPanel
        suggestions={suggestions}
        onDismiss={(id) => setDismissedSuggestionIds((current) => [...current, id])}
        className="absolute top-24 right-8 z-10 w-80"
      />

      {isFestivalOwner ? (
        <Button
          variant="primary"
          icon={<Pencil1Icon />}
          className="absolute top-10 right-8 shadow-md"
          disabled={!canEditMap}
          title={canEditMap ? undefined : "축제 초안 상태에서만 부스맵을 수정할 수 있습니다."}
          onClick={() => {
            if (canEditMap) router.push(`/console/festivals/${festivalId}/boothmap`);
          }}
        >
          {canEditMap ? "수정하기" : "수정 불가"}
        </Button>
      ) : null}

      <MapZoomControls
        className="absolute right-8 bottom-[142px] [&_button]:shadow-md"
        onZoomIn={() => setZoomStep((step) => step - 1)}
        onZoomOut={() => setZoomStep((step) => step + 1)}
      />

      <div className="absolute right-8 bottom-10 left-[340px]">
        {selectedBooth ? (
          <DashboardStatsBar selectedBooth={selectedBooth} />
        ) : dashboard?.dataAvailable ? (
          <div className="flex items-center gap-6 rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md">
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
