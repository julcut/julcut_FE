"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { distanceInMeters } from "@/features/staffMap/utils";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { updateQueueTailAsAdmin } from "./api";
import type { Booth, BoothZone } from "./types";

/** 구역에 속한 부스 좌표의 평균. 좌표가 있는 부스가 하나도 없으면 줄끝으로 쓸 수 없다. */
function zoneCenter(zone: BoothZone) {
  const points = zone.booths.filter(
    (booth): booth is Booth & { lat: number; lng: number } =>
      booth.lat !== undefined && booth.lng !== undefined,
  );
  if (points.length === 0) return null;
  return {
    lat: points.reduce((sum, booth) => sum + booth.lat, 0) / points.length,
    lng: points.reduce((sum, booth) => sum + booth.lng, 0) / points.length,
  };
}

/**
 * 선택한 부스의 줄끝을 갱신하는 폼. 스태프 앱의 `QueueUpdateSheet`와 같은 방식으로
 * 구역을 고르면 그 구역의 중심 좌표를 줄끝으로 보낸다. 관리자 콘솔은 지도 하단바
 * 한 줄 안에 들어가야 해서 시트 대신 인라인 폼으로 둔다.
 */
function QueueTailForm({
  festivalId,
  booth,
  zones,
  onUpdated,
}: {
  festivalId: string;
  booth: Booth;
  zones: BoothZone[];
  onUpdated: () => void;
}) {
  const [zoneId, setZoneId] = useState("");
  const selectableZones = zones.filter((zone) => zoneCenter(zone) !== null);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!booth.queueId) throw new Error("이 부스의 대기열 정보를 찾을 수 없습니다.");
      const zone = zones.find((candidate) => candidate.zoneId === zoneId);
      const center = zone ? zoneCenter(zone) : null;
      if (!center) throw new Error("구역 좌표를 찾을 수 없습니다.");
      const boothPoint =
        booth.lat !== undefined && booth.lng !== undefined
          ? { lat: booth.lat, lng: booth.lng }
          : null;
      return updateQueueTailAsAdmin(festivalId, booth.queueId, {
        tailLatitude: center.lat,
        tailLongitude: center.lng,
        queueTailMeters: boothPoint ? distanceInMeters(boothPoint, center) : undefined,
      });
    },
    onSuccess: () => {
      toast.success("줄끝 위치를 갱신했습니다.");
      onUpdated();
      setZoneId("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "줄끝을 갱신하지 못했습니다.")),
  });

  if (!booth.queueId || selectableZones.length === 0) return null;

  return (
    <form
      className="flex shrink-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        updateMutation.mutate();
      }}
    >
      <Select value={zoneId} onValueChange={setZoneId}>
        <SelectTrigger className="h-10 w-36" aria-label="줄끝 구역 선택">
          <SelectValue placeholder="구역 선택" />
        </SelectTrigger>
        <SelectContent>
          {selectableZones.map((zone) => (
            <SelectItem key={zone.zoneId} value={zone.zoneId}>
              {zone.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={!zoneId || updateMutation.isPending} className="shrink-0">
        {updateMutation.isPending ? "갱신 중..." : "줄끝 갱신"}
      </Button>
    </form>
  );
}

function BoothQueueUpdateBar({
  festivalId,
  booth,
  zones,
  canUpdateQueue,
  onUpdated,
}: {
  festivalId: string;
  booth: Booth;
  zones: BoothZone[];
  canUpdateQueue: boolean;
  onUpdated: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="body-small-bold wrap-anywhere text-zinc-950">{booth.name}</span>
          </div>
          <p className="body-caption text-zinc-500">
            혼잡도 {booth.congestionLevel ?? "미입력"} · 예상 대기시간{" "}
            {booth.waitMinutes == null ? "미입력" : `${booth.waitMinutes}분`}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {booth.lastQueueUpdater ? (
          <p className="body-caption min-w-0 wrap-anywhere text-zinc-500">
            최근 갱신: {booth.lastQueueUpdater.name}
          </p>
        ) : null}
        {canUpdateQueue ? (
          <QueueTailForm
            // 다른 부스를 고르면 이전 부스에 맞춰 둔 구역 선택은 의미가 없어 폼을 새로 띄운다.
            key={booth.boothId}
            festivalId={festivalId}
            booth={booth}
            zones={zones}
            onUpdated={onUpdated}
          />
        ) : null}
      </div>
    </div>
  );
}

export interface DashboardStatsBarProps {
  festivalId: string;
  selectedBooth: Booth;
  /** 줄끝 위치로 고를 수 있는 구역 목록. */
  zones: BoothZone[];
  /** 줄끝 갱신 폼 노출 여부. 진행중인 축제에 배정된 관리자에게만 연다. */
  canUpdateQueue: boolean;
  onUpdated: () => void;
}

export function DashboardStatsBar({
  festivalId,
  selectedBooth,
  zones,
  canUpdateQueue,
  onUpdated,
}: DashboardStatsBarProps) {
  return (
    <BoothQueueUpdateBar
      festivalId={festivalId}
      booth={selectedBooth}
      zones={zones}
      canUpdateQueue={canUpdateQueue}
      onUpdated={onUpdated}
    />
  );
}
