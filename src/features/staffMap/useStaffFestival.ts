"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { presentationBoundary, presentationOverlay } from "@/features/boothmap/mapPresentation";
import type { Booth, BoothZone, FestivalDashboard } from "@/features/dashboard/types";
import { useStaffAuthStore } from "@/store/staffAuthStore";
import { getFestivalQueues, getStaffFestivalDashboard, getStaffFestivalOperationsMap } from "./api";
import type { FestivalQueue } from "./types";
import { busiestBooth, centerOf, overallCongestion } from "./utils";

/** 구역을 나누지 않은 축제에서 모든 부스를 담는 가상 구역 id. */
export const UNZONED_ID = "unzoned";

export interface StaffZone extends BoothZone {
  /** 구역에 속한 부스들의 중심 좌표. 줄끝 위치를 보낼 때 이 좌표를 쓴다. */
  center: { lat: number; lng: number } | null;
}

export const STAFF_DASHBOARD_QUERY_KEY = "staff-festival-dashboard";
export const STAFF_QUEUES_QUERY_KEY = "staff-festival-queues";
export const STAFF_OPERATIONS_MAP_QUERY_KEY = "staff-festival-operations-map";

function toBooth(booth: FestivalDashboard["booths"][number], zoneId: string): Booth {
  return {
    boothId: String(booth.boothId),
    name: booth.boothName,
    zoneId,
    lat: booth.lat ?? undefined,
    lng: booth.lng ?? undefined,
    congestionLevel: booth.congestionLevel ?? undefined,
    waitMinutes: booth.waitMinutes ?? undefined,
    congestionUpdatedAt: booth.congestionUpdatedAt ?? undefined,
    lastQueueUpdater:
      booth.modifierName && booth.modifierType
        ? { name: booth.modifierName, role: booth.modifierType }
        : undefined,
  };
}

/**
 * 스태프 화면이 공통으로 쓰는 담당 축제 데이터.
 * 부스·구역·혼잡도는 대시보드 API에서, 줄(대기열) 정보는 운영 API에서 온다.
 */
export function useStaffFestival() {
  const session = useStaffAuthStore((state) => state.session);
  const festivalId = session?.festivalId ?? "";

  const dashboardQuery = useQuery({
    queryKey: [STAFF_DASHBOARD_QUERY_KEY, festivalId],
    queryFn: () => getStaffFestivalDashboard(festivalId),
    enabled: Boolean(festivalId),
  });

  const queuesQuery = useQuery({
    queryKey: [STAFF_QUEUES_QUERY_KEY, festivalId],
    queryFn: () => getFestivalQueues(festivalId),
    enabled: Boolean(festivalId),
  });

  /*
    부지 경계·팜플렛은 현장 운영 지도 조회로 받는다. 편집기 API(.../maps/{mapId}/editor)는
    총괄관리자 전용 편집 계약이라 스태프 토큰으로는 열리지 않고, 스태프는 경계·팜플렛을
    보기만 하면 된다. 지도 미등록·권한 부족은 재시도로 풀리지 않으므로 재시도하지 않고,
    이 조회가 실패해도 부스 핀·줄·대기시간은 그대로 보여야 하므로 isLoading·error에
    섞지 않는다.
  */
  const operationsMapQuery = useQuery({
    queryKey: [STAFF_OPERATIONS_MAP_QUERY_KEY, festivalId],
    queryFn: () => getStaffFestivalOperationsMap(festivalId),
    enabled: Boolean(festivalId),
    retry: false,
  });

  const zones = useMemo((): StaffZone[] => {
    const dashboard = dashboardQuery.data;
    if (!dashboard) return [];

    const buildZone = (zoneId: string, name: string, booths: Booth[]): StaffZone => ({
      zoneId,
      name,
      booths,
      center: centerOf(
        booths
          .filter((booth) => booth.lat !== undefined && booth.lng !== undefined)
          .map((booth) => ({ lat: booth.lat as number, lng: booth.lng as number })),
      ),
    });

    if (dashboard.zones.length === 0) {
      return [
        buildZone(
          UNZONED_ID,
          "전체",
          dashboard.booths.map((booth) => toBooth(booth, UNZONED_ID)),
        ),
      ];
    }

    const zoneIdByNodeId = new Map<string, string>();
    dashboard.zones.forEach((zone) => {
      zone.boothNodeIds.forEach((nodeId) => zoneIdByNodeId.set(nodeId, zone.zoneId));
    });

    const boothsByZoneId = new Map<string, Booth[]>();
    dashboard.booths.forEach((booth) => {
      const zoneId =
        (booth.roadmapNodePublicId ? zoneIdByNodeId.get(booth.roadmapNodePublicId) : undefined) ??
        UNZONED_ID;
      const list = boothsByZoneId.get(zoneId) ?? [];
      list.push(toBooth(booth, zoneId));
      boothsByZoneId.set(zoneId, list);
    });

    const result = [...dashboard.zones]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((zone) => buildZone(zone.zoneId, zone.name, boothsByZoneId.get(zone.zoneId) ?? []))
      .filter((zone) => zone.booths.length > 0);

    // 어느 구역에도 매칭되지 않은 부스는 목록에서 빠지지 않도록 마지막에 따로 묶는다.
    const unzoned = boothsByZoneId.get(UNZONED_ID) ?? [];
    if (unzoned.length > 0) {
      result.push(buildZone(UNZONED_ID, "구역 미지정", unzoned));
    }
    return result;
  }, [dashboardQuery.data]);

  const booths = useMemo(() => zones.flatMap((zone) => zone.booths), [zones]);

  const queueByBoothId = useMemo(() => {
    const map = new Map<string, FestivalQueue>();
    queuesQuery.data?.queues.forEach((queue) => map.set(String(queue.boothId), queue));
    return map;
  }, [queuesQuery.data]);

  // PamphletOverlay는 corners 객체 참조가 바뀌면 오버레이를 다시 그리므로 참조를 고정한다.
  const pamphlet = useMemo(
    () => presentationOverlay(operationsMapQuery.data?.presentation),
    [operationsMapQuery.data?.presentation],
  );
  const siteBoundary = useMemo(
    () => presentationBoundary(operationsMapQuery.data?.presentation),
    [operationsMapQuery.data?.presentation],
  );

  const mapCenter = useMemo(
    () =>
      centerOf(
        booths
          .filter((booth) => booth.lat !== undefined && booth.lng !== undefined)
          .map((booth) => ({ lat: booth.lat as number, lng: booth.lng as number })),
      ),
    [booths],
  );

  return {
    festivalId,
    staffName: session?.name ?? "",
    isLoading: dashboardQuery.isLoading || queuesQuery.isLoading,
    error: dashboardQuery.error,
    /** 줄(대기열) 조회만 실패한 경우. 지도와 혼잡도는 그대로 보여준다. */
    queuesError: queuesQuery.error,
    dashboard: dashboardQuery.data,
    festivalName: dashboardQuery.data?.festivalName ?? "",
    zones,
    booths,
    queueByBoothId,
    /** 팜플렛 이미지 오버레이. 등록되지 않았거나 조회에 실패하면 null이다. */
    pamphlet,
    /** 부지 경계 폴리곤. 등록되지 않았거나 조회에 실패하면 null이다. */
    siteBoundary,
    mapCenter,
    summary: {
      congestionLevel: overallCongestion(booths),
      averageWaitMinutes: dashboardQuery.data?.averageWaitMinutes ?? null,
      busiestBooth: busiestBooth(booths),
      updatedAt: dashboardQuery.data?.updatedAt ?? null,
    },
    refetch: () => {
      void dashboardQuery.refetch();
      void queuesQuery.refetch();
    },
    isRefetching: dashboardQuery.isRefetching || queuesQuery.isRefetching,
  };
}
