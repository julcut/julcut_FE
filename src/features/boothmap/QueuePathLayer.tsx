"use client";

import { CustomOverlayMap, Polygon, Polyline } from "react-kakao-maps-sdk";
import { formatWaitMinutes } from "@/lib/formatWaitMinutes";
import type { LatLng } from "./latLng";

export interface QueuePathItem {
  queueId: string;
  boothId: string;
  path: LatLng[] | null;
  waitMinutes: number | null | undefined;
  boothLat: number;
  boothLng: number;
}

export function boothsToQueuePathItems(
  booths: Array<{
    boothId: string;
    lat?: number;
    lng?: number;
    waitMinutes?: number | null;
  }>,
  queueByBoothId: Map<string, { queueId: string; path: LatLng[] | null }>,
): QueuePathItem[] {
  return booths.flatMap((booth) => {
    if (booth.lat === undefined || booth.lng === undefined) return [];
    const queue = queueByBoothId.get(booth.boothId);
    return [
      {
        queueId: queue?.queueId ?? `wait-${booth.boothId}`,
        boothId: booth.boothId,
        path: queue?.path ?? null,
        waitMinutes: booth.waitMinutes ?? null,
        boothLat: booth.lat,
        boothLng: booth.lng,
      },
    ];
  });
}

export interface QueuePathLayerProps {
  queues: QueuePathItem[];
  /** 참고용 QUEUE 노드. 운영 줄과 겹쳐도 자동 승격하지 않는다. */
  referenceLines?: Array<{ id: string; points: LatLng[]; geometryType: "POLYGON" | "POLYLINE" }>;
  showWaitLabel?: boolean;
}

/** 운영 대기줄과 대기시간. 경로가 없으면 선만 숨기고 시간은 남긴다. */
export function QueuePathLayer({
  queues,
  referenceLines = [],
  showWaitLabel = true,
}: QueuePathLayerProps) {
  return (
    <>
      {referenceLines.map((line) =>
        line.geometryType === "POLYGON" ? (
          <Polygon
            key={`ref-${line.id}`}
            path={line.points}
            strokeWeight={3}
            strokeColor="#71717a"
            strokeOpacity={0.7}
            fillOpacity={0.05}
          />
        ) : line.points.length >= 2 ? (
          <Polyline
            key={`ref-${line.id}`}
            path={line.points}
            strokeWeight={3}
            strokeColor="#71717a"
            strokeOpacity={0.7}
            strokeStyle="dash"
          />
        ) : null,
      )}
      {queues.map((queue) => (
        <QueuePathItemView key={queue.queueId} queue={queue} showWaitLabel={showWaitLabel} />
      ))}
    </>
  );
}

function QueuePathItemView({
  queue,
  showWaitLabel,
}: {
  queue: QueuePathItem;
  showWaitLabel: boolean;
}) {
  const path = queue.path && queue.path.length >= 2 ? queue.path : null;
  const labelPosition = path ? path[path.length - 1] : { lat: queue.boothLat, lng: queue.boothLng };
  return (
    <>
      {path ? (
        <Polyline path={path} strokeWeight={4} strokeColor="#fd7e14" strokeOpacity={0.95} />
      ) : null}
      {/*
        대기시간을 아직 모르는 부스에는 라벨을 달지 않는다. 「정보 없음」이 부스마다 붙으면
        지도가 그 글씨로 덮인다 — 부스를 막 만든 직후에는 전부 미상이라 더 심하다.
        0분은 실제 값이므로 그대로 보여 준다.
      */}
      {showWaitLabel && queue.waitMinutes != null ? (
        <CustomOverlayMap position={labelPosition} yAnchor={1} zIndex={18} clickable={false}>
          <span className="body-caption mb-1 rounded-md bg-white px-1.5 py-0.5 text-zinc-950 shadow-sm">
            {formatWaitMinutes(queue.waitMinutes)}
          </span>
        </CustomOverlayMap>
      ) : null}
    </>
  );
}
