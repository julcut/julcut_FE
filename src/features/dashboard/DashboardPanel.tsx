"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil1Icon } from "@radix-ui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { MapMetric } from "@/components/map/MapMetric";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { getCurrentMap } from "@/features/boothmap/api";
import { boothsToQueuePathItems } from "@/features/boothmap/QueuePathLayer";
import { presentationBoundary, presentationOverlay } from "@/features/boothmap/mapPresentation";
import { primaryFestivalCenter } from "@/features/boothmap/mapCenter";
import { getManagedFestival } from "@/features/festivals/api";
import { formatDday } from "@/features/festivals/dateFormat";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useConsoleUiStore } from "@/store/consoleUiStore";
import {
  getFestivalCongestion,
  getFestivalDashboard,
  getFestivalOperationSuggestions,
  getFestivalOperationsMap,
  getFestivalQueues,
} from "./api";
import { AiSuggestionPanel } from "./AiSuggestionPanel";
import { BoothMapView } from "./BoothMapView";
import { BoothTreeSidebar } from "./BoothTreeSidebar";
import { DashboardStatsBar } from "./DashboardStatsBar";
import type { Booth, BoothZone } from "./types";

/** 지도 위 흰 카드 안에서 쓰는 primary 링크 버튼. `Button`과 달리 실제 이동이 필요해 `Link`에 직접 스타일을 준다. */
const BOOTH_MAP_CTA_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2.5 rounded-md bg-primary px-4 py-2 body-small text-white transition-colors hover:bg-primary/90";

export function DashboardPanel({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const progressStatus = festivalQuery.data?.progressStatus;
  // 실시간 지표(혼잡도·대기열·AI 운영 제안)는 축제가 열려 있는 동안에만 의미가 있다.
  // 진행예정 축제에서 이 값을 그대로 보여주면 아직 시작하지도 않은 축제에
  // "활성 대기열 8개" 같은 숫자가 뜨므로 조회 자체를 하지 않는다.
  const isRealtimeScope = progressStatus === "ONGOING";
  const mapDataQuery = useQuery({
    queryKey: ["dashboard-map", festivalId, festivalQuery.data?.role],
    enabled: festivalQuery.isSuccess,
    queryFn: () => getCurrentMap(festivalId),
    // 지도 미등록 또는 좌표 누락은 재시도로 해결되지 않는다.
    retry: false,
  });
  /*
    부지 경계·팜플렛은 운영 지도 조회로 받는다. 편집기 API(.../maps/{mapId}/editor)는
    총괄관리자 전용 편집 계약이라 운영자(제2관리자·외부업자)에게는 권한이 없고,
    저장 전 초안 노드까지 통째로 내려온다. 대시보드는 보기만 하면 된다.
  */
  const operationsMapQuery = useQuery({
    queryKey: ["festival-operations-map", festivalId],
    enabled: festivalQuery.isSuccess,
    queryFn: () => getFestivalOperationsMap(festivalId),
    retry: false,
  });
  const dashboardQuery = useQuery({
    queryKey: ["festival-dashboard", festivalId],
    queryFn: () => getFestivalDashboard(festivalId),
  });
  const congestionQuery = useQuery({
    queryKey: ["festival-congestion", festivalId],
    enabled: isRealtimeScope,
    queryFn: () => getFestivalCongestion(festivalId),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["festival-operation-suggestions", festivalId],
    enabled: isRealtimeScope,
    queryFn: () => getFestivalOperationSuggestions(festivalId),
  });
  const queuesQuery = useQuery({
    queryKey: ["festival-queues", festivalId],
    enabled: isRealtimeScope,
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
    /*
      부스와 지도 노드를 잇는 값이 두 갈래다. 대시보드 응답은 부스에 달린
      roadmapNodePublicId를, 편집기는 노드에 달린 relatedBoothId를 쓴다. 노드 쪽에만
      연결이 있는 부스는 roadmapNodePublicId가 비어 구역을 못 찾고 "구역 미지정"으로
      떨어졌다. 운영 지도가 내려주는 boothId↔nodeId 쌍으로 그 빈칸을 메운다.
    */
    const nodeIdByBoothId = new Map(
      (operationsMapQuery.data?.booths ?? [])
        .filter((booth) => booth.nodeId)
        .map((booth) => [booth.boothId, booth.nodeId as string]),
    );
    return dashboardBooths.map((dashboardBooth) => {
      const congestion = congestionByBoothId.get(dashboardBooth.boothId);
      const queue = queueByBoothId.get(dashboardBooth.boothId);
      return {
        boothId: String(dashboardBooth.boothId),
        queueId: queue?.queueId,
        name: dashboardBooth.boothName,
        zoneId:
          zoneIdByNodeId.get(
            dashboardBooth.roadmapNodePublicId ?? nodeIdByBoothId.get(dashboardBooth.boothId) ?? "",
          ) ?? "unassigned",
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
    operationsMapQuery.data?.booths,
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
  // 선택 시점 스냅샷을 그대로 들고 있으면 줄끝을 갱신해도 하단바 값이 그대로다.
  // 최신 목록에서 같은 부스를 다시 찾아 화면에 흘려보낸다.
  const activeBooth = selectedBooth
    ? (mapBooths.find((booth) => booth.boothId === selectedBooth.boothId) ?? selectedBooth)
    : null;
  // 줄끝을 갱신하면 백엔드가 혼잡도 이력까지 함께 쌓으므로 관련 조회를 모두 다시 읽는다.
  const refetchRealtime = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["festival-dashboard", festivalId] });
    queryClient.invalidateQueries({ queryKey: ["festival-congestion", festivalId] });
    queryClient.invalidateQueries({ queryKey: ["festival-queues", festivalId] });
  }, [queryClient, festivalId]);
  const dashboardMapCenter = mapDataQuery.data?.center ?? mapCenter;
  const queuePathItems = useMemo(() => {
    const queueByBoothId = new Map(
      (queuesQuery.data?.queues ?? []).map((queue) => [String(queue.boothId), queue]),
    );
    return boothsToQueuePathItems(mapBooths, queueByBoothId);
  }, [mapBooths, queuesQuery.data?.queues]);
  const pamphlet = presentationOverlay(operationsMapQuery.data?.presentation);
  const siteBoundary = presentationBoundary(operationsMapQuery.data?.presentation);
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
  const festival = festivalQuery.data;
  const isFestivalOwner = festival?.role === "FESTIVAL_OWNER";
  // 종료된 축제의 부스 배치는 결과리포트의 근거 자료라 뒤늦게 바뀌면 안 된다.
  // 예전에는 `festivalStatus === "DRAFT"`(초안 여부)로 막고 있었는데, 그 값은
  // 공개 여부일 뿐이라 정작 종료된 축제는 그대로 편집됐다.
  const isCompleted = progressStatus === "COMPLETED";
  const canEditMap = isFestivalOwner && !isCompleted;
  const boothMapHref = `/console/festivals/${festivalId}/boothmap`;
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
          selectedBooth={activeBooth}
          onSelectBooth={setSelectedBooth}
          zoomStep={zoomStep}
          center={dashboardMapCenter}
          queues={queuePathItems}
          pamphlet={pamphlet}
          boundary={siteBoundary}
          onZoomByWheel={(direction) => setZoomStep((step) => step + direction)}
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
          selectedBoothId={activeBooth?.boothId}
          onSelectBooth={(booth) => {
            setSelectedBooth(booth);
            setBoothListOpen(false);
          }}
          emptyContent={
            <div className="flex flex-col items-start gap-2 rounded-md bg-zinc-100 px-4 py-3 text-left">
              <div className="flex flex-col gap-1">
                <p className="body-small-bold text-zinc-950">아직 등록된 부스가 없습니다.</p>
                <p className="body-caption text-zinc-950">
                  {isFestivalOwner
                    ? "부스맵에서 지도 위에 부스를 찍으면 여기에 구역별로 표시됩니다."
                    : "총괄관리자가 부스맵을 등록하면 여기에 구역별로 표시됩니다."}
                </p>
              </div>
              {isFestivalOwner && !isCompleted ? (
                <Link href={boothMapHref} className={BOOTH_MAP_CTA_CLASSES}>
                  부스맵 만들기
                </Link>
              ) : null}
            </div>
          }
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
            {isRealtimeScope ? (
              <AiSuggestionPanel
                suggestions={suggestions}
                onDismiss={(id) => setDismissedSuggestionIds((current) => [...current, id])}
                className="pointer-events-auto min-h-0 w-full overflow-y-auto"
              />
            ) : null}
          </div>
          {/*
            운영자에게는 부스맵 편집 권한이 아예 없어 버튼을 숨긴다. 총괄관리자에게는
            항상 "수정하기"로 보여 주고, 종료된 축제라 눌러도 소용없을 때만 비활성 +
            사유 툴팁을 붙인다(라벨 자체를 "수정 불가"로 바꾸면 무슨 버튼인지 알 수 없다).
          */}
          {isFestivalOwner ? (
            <div className="ml-auto shrink-0">
              <Button
                variant="primary"
                icon={<Pencil1Icon />}
                className="pointer-events-auto shrink-0 shadow-md"
                disabled={!canEditMap}
                title={canEditMap ? undefined : "종료된 축제의 부스맵은 수정할 수 없습니다."}
                onClick={() => {
                  if (canEditMap) router.push(boothMapHref);
                }}
              >
                수정하기
              </Button>
            </div>
          ) : null}
        </div>

        <div className="relative col-start-1 row-start-3 flex min-w-0 items-end gap-3 lg:col-start-2 lg:row-start-2 lg:gap-5">
          <div className="pointer-events-auto max-h-40 min-w-0 flex-1 overflow-y-auto lg:max-h-none">
            {activeBooth ? (
              <DashboardStatsBar
                festivalId={festivalId}
                selectedBooth={activeBooth}
                zones={mapZones}
                canUpdateQueue={isRealtimeScope && Boolean(festival?.role)}
                onUpdated={refetchRealtime}
              />
            ) : progressStatus === "UPCOMING" ? (
              <FestivalPreparationBar
                boothCount={mapBooths.length}
                mapReady={Boolean(dashboardMapCenter) && !mapDataQuery.isError}
                startDate={festival?.startDate ?? null}
              />
            ) : isCompleted ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md">
                <div className="min-w-0">
                  <p className="body-small-bold text-zinc-950">종료된 축제입니다.</p>
                  <p className="body-caption mt-1 text-zinc-500">
                    실시간 혼잡도와 대기열 지표는 더 이상 갱신되지 않습니다.
                  </p>
                </div>
                {isFestivalOwner ? (
                  <Link
                    href={`/console/festivals/${festivalId}/report`}
                    className={BOOTH_MAP_CTA_CLASSES}
                  >
                    결과리포트 보기
                  </Link>
                ) : null}
              </div>
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

/**
 * 아직 시작하지 않은 축제의 하단바. 실시간 운영 지표 대신 준비 현황을 보여준다.
 * 시작 전에는 방문자·대기열 수치가 전부 0이거나 비어 있어, 그대로 노출하면
 * 지표가 고장 난 것처럼 읽힌다.
 */
function FestivalPreparationBar({
  boothCount,
  mapReady,
  startDate,
}: {
  boothCount: number;
  mapReady: boolean;
  startDate: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-md lg:gap-6">
      <MapMetric
        value="진행 예정"
        valueClassName="body-regular-bold"
        label="축제 상태"
        description="아직 시작하지 않은 축제라 실시간 지표 대신 준비 현황을 보여줍니다."
      />
      <MapMetric
        value={startDate ? formatDday(startDate) : "날짜 미정"}
        valueClassName="body-regular-bold"
        label="개막까지"
        description="오늘부터 축제 시작일까지 남은 일수입니다."
      />
      <MapMetric
        value={`${boothCount.toLocaleString()} 개`}
        valueClassName="body-regular-bold"
        label="등록된 부스"
        description="부스맵에 좌표까지 등록된 부스 수입니다."
      />
      <MapMetric
        value={mapReady ? "준비 완료" : "준비 필요"}
        valueClassName="body-regular-bold"
        label="지도"
        description="축제 위치 좌표와 부스맵이 모두 등록되면 준비 완료로 표시됩니다."
      />
    </div>
  );
}
