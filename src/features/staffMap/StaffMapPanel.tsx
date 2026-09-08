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

export function StaffMapPanel() {
  const searchParams = useSearchParams();
  const boothIdParam = searchParams.get("boothId");
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(boothIdParam);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const festival = useStaffFestival();

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

  const queueDisabledReason = !selectedQueue
    ? festival.queuesError
      ? "대기열 정보를 불러오지 못해 줄끝을 갱신할 수 없습니다."
      : "이 부스에는 아직 대기열이 만들어지지 않았습니다."
    : selectableZones.length === 0
      ? "구역 정보가 없어 줄끝 위치를 고를 수 없습니다."
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
        center={festival.mapCenter}
        queues={boothsToQueuePathItems(festival.booths, festival.queueByBoothId)}
        pamphlet={festival.pamphlet}
        boundary={festival.siteBoundary}
        onZoomByWheel={(direction) => setZoomStep((step) => step + direction)}
      />

      <MapZoomControls
        className="absolute top-5 left-5 z-10 [&_button]:size-9 [&_button]:shadow-md"
        onZoomIn={() => setZoomStep((step) => step - 1)}
        onZoomOut={() => setZoomStep((step) => step + 1)}
      />

      {selectedBooth && selectedQueue && queueSheetOpen ? (
        <QueueUpdateSheet
          // 부스가 바뀌면 구역 선택을 초기화하기 위해 새로 마운트한다.
          key={selectedBooth.boothId}
          festivalId={festival.festivalId}
          booth={selectedBooth}
          queue={selectedQueue}
          zones={selectableZones}
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
