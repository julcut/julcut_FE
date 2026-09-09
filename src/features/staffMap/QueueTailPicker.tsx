"use client";

import { useState } from "react";
import { Map, CustomOverlayMap, Polyline } from "react-kakao-maps-sdk";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import { distanceInMeters } from "./utils";

// 지도 레벨은 `2 + zoomStep`이고 이 지도는 레벨 1~8만 허용한다.
const MIN_ZOOM_STEP = -1;
const MAX_ZOOM_STEP = 6;

function clampZoomStep(step: number) {
  return Math.min(Math.max(step, MIN_ZOOM_STEP), MAX_ZOOM_STEP);
}

export interface QueueTailPoint {
  lat: number;
  lng: number;
}

export interface QueueTailPickerProps {
  boothName: string;
  /** 부스 좌표. 없으면 줄 길이를 계산할 수 없어 거리 안내를 숨긴다. */
  boothPoint: QueueTailPoint | null;
  /** 지도 초기 중심. 부스 좌표가 없는 축제에서도 지도를 띄울 수 있게 따로 받는다. */
  center: QueueTailPoint;
  /** 이미 기록된 줄끝 좌표. 다시 열었을 때 그 자리에서 시작한다. */
  initialTail: QueueTailPoint | null;
  onCancel: () => void;
  onConfirm: (point: QueueTailPoint) => void;
}

/**
 * 줄 끝 지점을 지도에서 직접 찍는 전체 화면 시트.
 *
 * 구역 중심만 고를 수 있던 시절에는 실제 줄 길이와 무관한 거리가 서버로 넘어가
 * "여유"를 보고할 방법이 아예 없었다. 스태프가 서 있는 자리를 그대로 찍게 한다.
 */
export function QueueTailPicker({
  boothName,
  boothPoint,
  center,
  initialTail,
  onCancel,
  onConfirm,
}: QueueTailPickerProps) {
  const [loading, error] = useKakaoMapLoader();
  const [tail, setTail] = useState<QueueTailPoint | null>(initialTail);
  const [zoomStep, setZoomStep] = useState(MIN_ZOOM_STEP);

  const meters = boothPoint && tail ? distanceInMeters(boothPoint, tail) : null;
  // 지도가 뜨지 않으면 확대·축소 버튼도 눌러 봐야 소용없으므로 감춘다.
  const mapReady = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) && !error && !loading;

  return (
    // 스태프 화면은 402px 폭 안에서 동작하므로 그 폭에 맞춰 화면 전체를 덮는다.
    <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-[402px] flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <p className="body-regular-bold truncate text-zinc-950">{boothName}</p>
          <p className="body-caption text-zinc-500">줄이 끝나는 지점을 지도에서 눌러주세요.</p>
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="줄 끝 선택 닫기"
          icon={<Cross2Icon />}
          onClick={onCancel}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        <QueueTailMapArea
          loading={loading}
          error={error}
          center={center}
          zoomStep={zoomStep}
          boothPoint={boothPoint}
          tail={tail}
          onPick={setTail}
        />
        {mapReady ? (
          <MapZoomControls
            className="absolute top-5 left-5 z-10 [&_button]:size-9 [&_button]:shadow-md"
            zoomInDisabled={zoomStep <= MIN_ZOOM_STEP}
            zoomOutDisabled={zoomStep >= MAX_ZOOM_STEP}
            onZoomIn={() => setZoomStep((step) => clampZoomStep(step - 1))}
            onZoomOut={() => setZoomStep((step) => clampZoomStep(step + 1))}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-zinc-200 px-4 pt-3 pb-8">
        <p className="body-small text-zinc-950" role="status">
          {tail
            ? meters === null
              ? "줄 끝 지점을 선택했습니다."
              : `부스에서 약 ${meters}m 지점을 선택했습니다.`
            : "아직 줄 끝 지점을 선택하지 않았습니다."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            취소
          </Button>
          <Button
            className="flex-1"
            disabled={!tail}
            onClick={() => {
              if (tail) onConfirm(tail);
            }}
          >
            이 지점으로 지정
          </Button>
        </div>
      </div>
    </div>
  );
}

function QueueTailMapArea({
  loading,
  error,
  center,
  zoomStep,
  boothPoint,
  tail,
  onPick,
}: {
  loading: boolean;
  error: unknown;
  center: QueueTailPoint;
  zoomStep: number;
  boothPoint: QueueTailPoint | null;
  tail: QueueTailPoint | null;
  onPick: (point: QueueTailPoint) => void;
}) {
  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return <QueueTailMapNotice message="NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다." error />;
  }
  if (error) {
    return <QueueTailMapNotice message="카카오맵을 불러오지 못했습니다." error />;
  }
  if (loading) {
    return <QueueTailMapNotice message="지도를 불러오는 중..." />;
  }

  return (
    <Map
      center={center}
      isPanto={false}
      level={2 + zoomStep}
      scrollwheel={false}
      className="h-full w-full"
      // 줄 끝을 찍을 때 카카오 기본 더블클릭 확대가 같이 걸리지 않게 한다.
      disableDoubleClickZoom
      onCreate={(map) => {
        map.setMinLevel(1);
        map.setMaxLevel(8);
      }}
      onClick={(_target, mouseEvent) => {
        const latLng = mouseEvent.latLng;
        if (!latLng) return;
        onPick({ lat: latLng.getLat(), lng: latLng.getLng() });
      }}
    >
      {boothPoint && tail ? (
        <Polyline
          path={[boothPoint, tail]}
          strokeColor="#FD7E14"
          strokeWeight={4}
          strokeOpacity={0.9}
        />
      ) : null}
      {boothPoint ? (
        <CustomOverlayMap position={boothPoint} zIndex={10}>
          <span
            role="img"
            aria-label="부스 위치"
            className="block size-3 rounded-full border border-white bg-zinc-950 shadow-sm"
          />
        </CustomOverlayMap>
      ) : null}
      {tail ? (
        <CustomOverlayMap position={tail} zIndex={20}>
          <span
            role="img"
            aria-label="선택한 줄 끝 위치"
            className="block size-4 rounded-full border-2 border-white bg-point-600 shadow-md"
          />
        </CustomOverlayMap>
      ) : null}
    </Map>
  );
}

function QueueTailMapNotice({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 px-4 text-center">
      <p className={error ? "body-small text-error" : "body-small text-zinc-500"}>{message}</p>
    </div>
  );
}
