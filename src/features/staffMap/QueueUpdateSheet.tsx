"use client";

import { useState } from "react";
import { Cross2Icon, DrawingPinIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CONGESTION_LABEL, CONGESTION_SOLID_CLASSES } from "@/components/ui/CongestionBadge";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { AdminBadge, StaffBadge } from "@/components/ui/RoleBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Booth, CongestionLevel } from "@/features/dashboard/types";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { updateBoothCongestion, updateQueueTail } from "./api";
import { QueueTailPicker, type QueueTailPoint } from "./QueueTailPicker";
import type { FestivalQueue } from "./types";
import type { StaffZone } from "./useStaffFestival";
import { distanceInMeters, formatRelativeTime } from "./utils";

const CONGESTION_LEVELS: CongestionLevel[] = ["LOW", "MEDIUM", "HIGH"];

export interface QueueUpdateSheetProps {
  festivalId: string;
  booth: Booth;
  queue: FestivalQueue;
  /** 줄끝 위치로 빠르게 고를 수 있는 구역(중심 좌표가 있는 구역만). */
  zones: StaffZone[];
  /** 지도 초기 중심. 부스 좌표가 없어도 줄 끝을 찍을 수 있게 축제 중심을 받는다. */
  mapCenter: QueueTailPoint;
  onClose: () => void;
  onUpdated: () => void;
}

/**
 * 선택한 부스의 줄끝 위치와 혼잡도를 갱신하는 하단 시트.
 *
 * 줄끝만 보내면 서버가 줄 길이로 혼잡도와 대기시간을 자동 환산한다. 현장에서는 그
 * 환산이 맞지 않는 경우가 있어 스태프가 직접 등급과 대기시간을 정할 수 있고,
 * 직접 정한 값이 자동 환산값을 덮어쓰도록 줄끝을 먼저 보낸 뒤 혼잡도를 보낸다.
 */
export function QueueUpdateSheet({
  festivalId,
  booth,
  queue,
  zones,
  mapCenter,
  onClose,
  onUpdated,
}: QueueUpdateSheetProps) {
  const [zoneId, setZoneId] = useState<string>("");
  const [pickedTail, setPickedTail] = useState<QueueTailPoint | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 자동 환산값을 기본값으로 채워 두고, 스태프가 건드린 경우에만 서버로 보낸다.
  const [congestionLevel, setCongestionLevel] = useState<CongestionLevel | null>(
    booth.congestionLevel ?? null,
  );
  const [waitMinutes, setWaitMinutes] = useState<string>(
    booth.waitMinutes === undefined ? "" : String(booth.waitMinutes),
  );
  const [congestionEdited, setCongestionEdited] = useState(false);
  const [validationError, setValidationError] = useState("");

  const boothPoint =
    booth.lat !== undefined && booth.lng !== undefined ? { lat: booth.lat, lng: booth.lng } : null;
  const selectedZone = zones.find((zone) => zone.zoneId === zoneId) ?? null;
  const tailPoint = pickedTail ?? selectedZone?.center ?? null;
  const tailMeters = boothPoint && tailPoint ? distanceInMeters(boothPoint, tailPoint) : null;
  const parsedWaitMinutes = Number(waitMinutes);
  const hasValidWaitMinutes =
    waitMinutes.trim() !== "" && Number.isInteger(parsedWaitMinutes) && parsedWaitMinutes >= 0;
  const canSubmit = Boolean(tailPoint) || congestionEdited;

  const updateMutation = useMutation({
    mutationFn: async () => {
      // 줄끝 갱신이 혼잡도를 다시 계산하므로 스태프가 고른 값보다 먼저 보낸다.
      if (tailPoint) {
        await updateQueueTail(festivalId, queue.queueId, {
          tailLatitude: tailPoint.lat,
          tailLongitude: tailPoint.lng,
          queueTailMeters: tailMeters ?? undefined,
        });
      }
      if (congestionEdited && congestionLevel) {
        await updateBoothCongestion(festivalId, booth.boothId, {
          waitMinutes: parsedWaitMinutes,
          congestionLevel,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        tailPoint && congestionEdited
          ? "줄끝 위치와 혼잡도를 갱신했습니다."
          : tailPoint
            ? "줄끝 위치를 갱신했습니다."
            : "혼잡도를 갱신했습니다.",
      );
      onUpdated();
      // 갱신된 값은 부스 바에서 다시 확인할 수 있으므로 시트는 닫는다.
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "현장 정보를 갱신하지 못했습니다."));
    },
  });

  return (
    // 화면설계서 EDIT01: 지도 위에 화면 폭 전체로 올라오는 하단 모달.
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-full overflow-y-auto rounded-t-2xl border-t border-zinc-200 bg-white px-4 pt-3 pb-8 shadow-lg">
      {/* 부스명은 가운데, 닫기는 오른쪽 끝에 둔다. */}
      <div className="relative flex items-center justify-center border-b border-zinc-200 pb-3">
        <p className="body-large-bold min-w-0 truncate px-8 text-center text-zinc-950">
          {booth.name}
        </p>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="닫기"
          icon={<Cross2Icon />}
          onClick={onClose}
          className="absolute top-0 right-0"
          iconClassName="size-3 [&_svg]:size-3"
        />
      </div>

      {/* 화면설계서처럼 좌우로 꽉 찬 회색 띠에 담는다(시트 여백을 되돌려 끝까지 채운다). */}
      <div className="-mx-4 mt-3 flex items-center justify-between bg-zinc-50 px-4 py-2">
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
          <dt className="body-small text-zinc-950">마지막 혼잡도 갱신자</dt>
          <dd className="flex items-center gap-2">
            {booth.lastQueueUpdater ? (
              <>
                <span className="body-small text-zinc-950">{booth.lastQueueUpdater.name}</span>
                {booth.lastQueueUpdater.role === "STAFF" ? <StaffBadge /> : <AdminBadge />}
              </>
            ) : (
              <span className="body-small text-zinc-400">기록 없음</span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="body-small text-zinc-950">마지막 줄끝갱신자</dt>
          <dd className="flex items-center gap-2">
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
        className="mt-5 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (congestionEdited && !congestionLevel) {
            setValidationError("혼잡도를 선택해주세요.");
            return;
          }
          if (congestionEdited && !hasValidWaitMinutes) {
            setValidationError("예상 대기시간은 0 이상의 정수로 입력해주세요.");
            return;
          }
          setValidationError("");
          updateMutation.mutate();
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="body-small-bold text-zinc-950">줄 끝 위치</legend>
          <p className="body-caption text-zinc-500">
            {tailPoint
              ? tailMeters === null
                ? pickedTail
                  ? "지도에서 찍은 지점으로 갱신합니다."
                  : `${selectedZone?.name} 구역 중심으로 갱신합니다.`
                : pickedTail
                  ? `지도에서 찍은 지점(부스에서 약 ${tailMeters}m)으로 갱신합니다.`
                  : `${selectedZone?.name} 구역 중심(부스에서 약 ${tailMeters}m)으로 갱신합니다.`
              : "고르지 않으면 줄 끝 위치는 그대로 둡니다."}
          </p>
          <Button
            variant="outline"
            className="w-full"
            icon={<DrawingPinIcon />}
            onClick={() => setPickerOpen(true)}
          >
            지도에서 줄 끝 찍기
          </Button>
          {zones.length > 0 ? (
            <Select
              value={zoneId}
              onValueChange={(value) => {
                setZoneId(value);
                // 구역을 고르면 지도에서 찍은 지점 대신 그 구역 중심을 쓴다.
                setPickedTail(null);
              }}
            >
              <SelectTrigger className="h-10 w-full flex-row-reverse justify-end gap-2">
                <SelectValue placeholder="구역으로 빠르게 선택" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.zoneId} value={zone.zoneId}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="body-small-bold text-zinc-950">혼잡도</legend>
          <p className="body-caption text-zinc-500">
            줄 길이로 자동 환산된 값입니다. 바꾸면 직접 정한 값이 저장됩니다.
          </p>
          <div className="flex gap-2">
            {CONGESTION_LEVELS.map((level) => {
              const selected = congestionLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  className={`flex-1 rounded-md border py-2 body-small-bold transition-colors ${
                    selected
                      ? `border-transparent ${CONGESTION_SOLID_CLASSES[level]}`
                      : "border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-100"
                  }`}
                  onClick={() => {
                    setCongestionLevel(level);
                    setCongestionEdited(true);
                    setValidationError("");
                  }}
                >
                  {CONGESTION_LABEL[level]}
                </button>
              );
            })}
          </div>
          <Input
            label="예상 대기시간(분)"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={waitMinutes}
            onChange={(event) => {
              setWaitMinutes(event.target.value);
              setCongestionEdited(true);
              setValidationError("");
            }}
          />
        </fieldset>

        <Button type="submit" disabled={!canSubmit || updateMutation.isPending}>
          {updateMutation.isPending ? "갱신 중..." : "갱신하기"}
        </Button>
      </form>

      {validationError ? <p className="body-caption mt-2 text-error">{validationError}</p> : null}

      {updateMutation.isError ? (
        <p className="body-caption mt-2 text-error">
          {getApiErrorMessage(updateMutation.error, "현장 정보를 갱신하지 못했습니다.")}
        </p>
      ) : null}

      {pickerOpen ? (
        <QueueTailPicker
          boothName={booth.name}
          boothPoint={boothPoint}
          center={pickedTail ?? boothPoint ?? mapCenter}
          initialTail={
            pickedTail ??
            (queue.tailLatitude !== null && queue.tailLongitude !== null
              ? { lat: queue.tailLatitude, lng: queue.tailLongitude }
              : null)
          }
          onCancel={() => setPickerOpen(false)}
          onConfirm={(point) => {
            setPickedTail(point);
            // 지도에서 직접 찍은 지점이 구역 중심보다 우선한다.
            setZoneId("");
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
