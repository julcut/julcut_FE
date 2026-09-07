"use client";

import { useState } from "react";
import { Cross2Icon, ReloadIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CongestionText } from "@/components/ui/CongestionBadge";
import { IconButton } from "@/components/ui/IconButton";
import { AdminBadge, StaffBadge } from "@/components/ui/RoleBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Booth } from "@/features/dashboard/types";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { updateQueueTail } from "./api";
import type { FestivalQueue } from "./types";
import type { StaffZone } from "./useStaffFestival";
import { distanceInMeters, formatRelativeTime } from "./utils";

export interface QueueUpdateSheetProps {
  festivalId: string;
  booth: Booth;
  queue: FestivalQueue;
  /** 줄끝 위치로 고를 수 있는 구역(중심 좌표가 있는 구역만). */
  zones: StaffZone[];
  onClose: () => void;
  onUpdated: () => void;
}

/**
 * 선택한 부스의 줄끝 위치를 갱신하는 하단 시트.
 * 구역을 고르면 그 구역의 중심 좌표를 줄끝으로 보낸다.
 */
export function QueueUpdateSheet({
  festivalId,
  booth,
  queue,
  zones,
  onClose,
  onUpdated,
}: QueueUpdateSheetProps) {
  const [zoneId, setZoneId] = useState<string>("");

  const updateMutation = useMutation({
    mutationFn: () => {
      const zone = zones.find((candidate) => candidate.zoneId === zoneId);
      if (!zone?.center) {
        throw new Error("구역 좌표를 찾을 수 없습니다.");
      }
      const boothPoint =
        booth.lat !== undefined && booth.lng !== undefined
          ? { lat: booth.lat, lng: booth.lng }
          : null;
      return updateQueueTail(festivalId, queue.queueId, {
        tailLatitude: zone.center.lat,
        tailLongitude: zone.center.lng,
        queueTailMeters: boothPoint ? distanceInMeters(boothPoint, zone.center) : undefined,
      });
    },
    onSuccess: () => {
      toast.success("줄끝 위치를 갱신했습니다.");
      onUpdated();
      // 갱신된 값은 부스 바에서 다시 확인할 수 있으므로 시트는 닫는다.
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "줄끝을 갱신하지 못했습니다."));
    },
  });

  return (
    <div className="border-t border-zinc-200 bg-white px-5 py-4">
      <div className="relative flex items-center justify-center border-b border-zinc-200 pb-3">
        <p className="body-regular-bold truncate px-8 text-center text-zinc-950">{booth.name}</p>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="닫기"
          icon={<Cross2Icon />}
          onClick={onClose}
          className="absolute right-0"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="body-caption text-zinc-500">실시간 혼잡도정보</p>
        <div className="flex items-center gap-1">
          <span className="body-caption text-zinc-500">
            {formatRelativeTime(booth.congestionUpdatedAt)}
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="혼잡도 정보 새로고침"
            icon={<ReloadIcon />}
            iconClassName="text-zinc-500"
            onClick={onUpdated}
          />
        </div>
      </div>

      <dl className="mt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <dt className="body-small text-zinc-950">혼잡도</dt>
          <dd>
            {booth.congestionLevel ? (
              <CongestionText level={booth.congestionLevel} />
            ) : (
              <span className="body-small text-zinc-400">미입력</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="body-small text-zinc-950">마지막 줄끝갱신자</dt>
          <dd className="flex items-center gap-2">
            <span className="body-caption text-zinc-500">
              {formatRelativeTime(queue.updatedAt)}
            </span>
            {queue.lastModifierType ? (
              <>
                {queue.lastModifierName ? (
                  <span className="body-small text-zinc-950">{queue.lastModifierName}</span>
                ) : null}
                {queue.lastModifierType === "STAFF" ? <StaffBadge /> : <AdminBadge />}
              </>
            ) : (
              <span className="body-small text-zinc-400">기록 없음</span>
            )}
          </dd>
        </div>
      </dl>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate();
        }}
      >
        <Select value={zoneId} onValueChange={setZoneId}>
          <SelectTrigger className="h-10 w-full flex-row-reverse justify-end gap-2">
            <SelectValue placeholder="구역 선택" />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.zoneId} value={zone.zoneId}>
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!zoneId || updateMutation.isPending} className="shrink-0">
          {updateMutation.isPending ? "갱신 중..." : "줄끝 갱신하기"}
        </Button>
      </form>

      {updateMutation.isError ? (
        <p className="body-caption mt-2 text-error">
          {getApiErrorMessage(updateMutation.error, "줄끝을 갱신하지 못했습니다.")}
        </p>
      ) : null}
    </div>
  );
}
