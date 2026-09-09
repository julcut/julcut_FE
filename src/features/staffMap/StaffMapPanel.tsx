"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { BoothMapView } from "@/features/dashboard/BoothMapView";
import { boothsToQueuePathItems } from "@/features/boothmap/QueuePathLayer";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { QueueUpdateSheet } from "./QueueUpdateSheet";
import { StaffBoothBar } from "./StaffBoothBar";
import { StaffFestivalBar } from "./StaffFestivalBar";
import { useStaffFestival, type StaffZone } from "./useStaffFestival";
import { distanceInMeters } from "./utils";

/** 줄끝 좌표에서 가장 가까운 구역. 서버는 좌표만 저장하므로 구역 이름은 역으로 찾는다. */
function zoneOfTail(
  zones: StaffZone[],
  tail: { lat: number; lng: number } | null,
): StaffZone | null {
  if (!tail) return null;
  let nearest: { zone: StaffZone; meters: number } | null = null;
  zones.forEach((zone) => {
    if (!zone.center) return;
    const meters = distanceInMeters(tail, zone.center);
    if (!nearest || meters < nearest.meters) nearest = { zone, meters };
  });
  return nearest ? (nearest as { zone: StaffZone }).zone : null;
}

/*
  `BoothMapView`는 카카오 지도 레벨을 `2 + zoomStep`으로 계산한다. 스태프 화면은
  폭 402px 안에서 부스를 봐야 해서 콘솔 기본값보다 한 단계 더 확대한 레벨 1에서
  시작하고, 지도가 허용하는 레벨 1~8을 그대로 zoomStep 범위로 쓴다.

  범위를 넘겨 눌러도 지도 레벨은 그대로라, 예전에는 확대 버튼을 두 번 헛누르면
  축소 버튼도 세 번을 눌러야 겨우 축소되는 상태가 됐다. 여기서 값을 가두고
  한계에서는 버튼도 비활성화한다.
*/
const STAFF_MAP_MIN_LEVEL = 1;
const MIN_ZOOM_STEP = STAFF_MAP_MIN_LEVEL - 2;
const MAX_ZOOM_STEP = 8 - 2;

function clampZoomStep(step: number) {
  return Math.min(Math.max(step, MIN_ZOOM_STEP), MAX_ZOOM_STEP);
}

export function StaffMapPanel() {
  const searchParams = useSearchParams();
  const boothIdParam = searchParams.get("boothId");
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(boothIdParam);
  const [appliedBoothIdParam, setAppliedBoothIdParam] = useState<string | null>(boothIdParam);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [zoomStep, setZoomStep] = useState(MIN_ZOOM_STEP);
  const festival = useStaffFestival();

  /*
    부스검색에서 부스를 고르면 `?boothId=`만 바뀐 채로 이 화면에 들어온다. 이 화면은
    정적으로 미리 렌더되므로 첫 렌더의 쿼리는 비어 있을 수 있고, 마운트 시점의 값만
    쓰면 그 선택이 통째로 사라진다. 쿼리가 바뀔 때마다 선택에 반영한다.
  */
  if (boothIdParam !== appliedBoothIdParam) {
    setAppliedBoothIdParam(boothIdParam);
    setSelectedBoothId(boothIdParam);
    setQueueSheetOpen(false);
  }

  const selectedBooth = useMemo(
    () => festival.booths.find((booth) => booth.boothId === selectedBoothId) ?? null,
    [festival.booths, selectedBoothId],
  );
  const selectedZone = useMemo(
    () => festival.zones.find((zone) => zone.zoneId === selectedBooth?.zoneId) ?? null,
    [festival.zones, selectedBooth],
  );
  const selectedQueue = selectedBooth
    ? festival.queueByBoothId.get(selectedBooth.boothId)
    : undefined;
  const selectableZones = useMemo(
    () => festival.zones.filter((zone) => zone.center !== null),
    [festival.zones],
  );

  const tailZone = useMemo(() => {
    if (!selectedQueue?.tailLatitude || !selectedQueue.tailLongitude) return null;
    return zoneOfTail(festival.zones, {
      lat: selectedQueue.tailLatitude,
      lng: selectedQueue.tailLongitude,
    });
  }, [festival.zones, selectedQueue]);

  if (festival.isLoading) {
    return <StaffMapState message="담당 축제 정보를 불러오는 중..." />;
  }

  if (festival.error) {
    return (
      <StaffMapState
        error
        message={getApiErrorMessage(festival.error, "담당 축제 정보를 불러오지 못했습니다.")}
      />
    );
  }

  // 줄 끝은 지도에서 직접 찍을 수 있으므로 구역이 없어도 갱신할 수 있다.
  const queueDisabledReason = !selectedQueue
    ? festival.queuesError
      ? "대기열 정보를 불러오지 못해 줄끝을 갱신할 수 없습니다."
      : "이 부스에는 아직 대기열이 만들어지지 않았습니다."
    : null;

  if (!festival.mapCenter) {
    return <StaffMapState message="지도에 표시할 부스 좌표가 없습니다." />;
  }

  // 화면설계서 MAIN01/EDIT01은 지도를 화면 전체로 깔고 그 위에 하단바·줄끝갱신 모달을 얹는다.
  return (
    <div className="relative min-h-0 flex-1">
      <BoothMapView
        booths={festival.booths}
        facilities={festival.facilities}
        selectedBooth={selectedBooth}
        onSelectBooth={(booth) => {
          setSelectedBoothId(booth?.boothId ?? null);
          setQueueSheetOpen(false);
        }}
        showPopup={false}
        zoomStep={zoomStep}
        minLevel={STAFF_MAP_MIN_LEVEL}
        center={festival.mapCenter}
        queues={boothsToQueuePathItems(festival.booths, festival.queueByBoothId)}
        pamphlet={festival.pamphlet}
        boundary={festival.siteBoundary}
        onZoomByWheel={(direction) => setZoomStep((step) => clampZoomStep(step + direction))}
      />

      <MapZoomControls
        className="absolute top-5 left-5 z-10 [&_button]:size-9 [&_button]:shadow-md"
        zoomInDisabled={zoomStep <= MIN_ZOOM_STEP}
        zoomOutDisabled={zoomStep >= MAX_ZOOM_STEP}
        onZoomIn={() => setZoomStep((step) => clampZoomStep(step - 1))}
        onZoomOut={() => setZoomStep((step) => clampZoomStep(step + 1))}
      />

      {selectedBooth && selectedQueue && queueSheetOpen ? (
        <QueueUpdateSheet
          // 부스가 바뀌면 구역 선택을 초기화하기 위해 새로 마운트한다.
          key={selectedBooth.boothId}
          festivalId={festival.festivalId}
          booth={selectedBooth}
          queue={selectedQueue}
          zones={selectableZones}
          mapCenter={festival.mapCenter}
          onClose={() => setQueueSheetOpen(false)}
          onUpdated={festival.refetch}
        />
      ) : selectedBooth ? (
        <StaffBoothBar
          booth={selectedBooth}
          zoneName={selectedZone?.name ?? "구역 미지정"}
          queueTailZoneName={tailZone?.name ?? null}
          disabledReason={queueDisabledReason}
          onUpdateQueue={() => setQueueSheetOpen(true)}
        />
      ) : (
        <StaffFestivalBar
          title={festival.festivalName || "현장 운영 현황"}
          congestionLevel={festival.summary.congestionLevel}
          averageWaitMinutes={festival.summary.averageWaitMinutes}
          busiestBooth={festival.summary.busiestBooth}
        />
      )}
    </div>
  );
}

function StaffMapState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <p className={error ? "body-small text-error" : "body-small text-zinc-500"}>{message}</p>
    </div>
  );
}
