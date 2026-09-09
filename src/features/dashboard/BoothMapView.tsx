"use client";

import { useEffect, useRef, useState } from "react";
import { Map, CustomOverlayMap, Polygon } from "react-kakao-maps-sdk";
import { Cross2Icon } from "@radix-ui/react-icons";
import { IconButton } from "@/components/ui/IconButton";
import { formatWaitMinutes } from "@/lib/formatWaitMinutes";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import { PamphletOverlay } from "@/features/boothmap/PamphletOverlay";
import { QueuePathLayer, type QueuePathItem } from "@/features/boothmap/QueuePathLayer";
import { nodeTypeIcon, nodeTypeLabel } from "@/features/boothmap/nodeTypeIcons";
import type { LocalPamphletOverlay } from "@/features/boothmap/mapPresentation";
import type { LatLng } from "@/features/boothmap/latLng";
import type { Booth, CongestionLevel, FacilityMarker } from "./types";

/**
 * 부스가 아닌 핀에 씌우는 동그란 아이콘 배지.
 *
 * 편집기 지도와 같은 규칙이다. 부스는 지도에 가장 많이 찍히는 유형이라 점으로 두고,
 * 화장실·입구·출구·시설만 아이콘으로 구분한다.
 */
const PIN_ICON_CLASSES =
  "flex size-5 items-center justify-center rounded-full border border-white bg-point-600 text-white shadow-sm [&_svg]:size-3";

/** 지도 마커 위에 뜨는 부스 상세정보 말풍선. 아래쪽 중앙에서 마커를 향해 뾰족한 꼬리가 이어진다. */
function BoothPopup({ booth, onClose }: { booth: Booth; onClose: () => void }) {
  return (
    <div className="mb-2.5 flex flex-col items-center">
      <div className="w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-white p-5">
        <div className="relative flex items-center justify-center border-b border-zinc-200 pb-3">
          <p className="body-large-bold min-w-0 px-8 text-center wrap-anywhere text-zinc-950">
            {booth.name}
          </p>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="닫기"
            icon={<Cross2Icon />}
            onClick={onClose}
            className="absolute right-0"
          />
        </div>

        <div className="mt-3 rounded-md bg-zinc-100 px-3 py-2">
          <p className="body-small-bold text-zinc-950">
            혼잡도 {booth.congestionLevel ?? "미입력"}
          </p>
          <p className="body-caption text-zinc-500">
            예상 대기시간 {formatWaitMinutes(booth.waitMinutes)}
          </p>
        </div>
      </div>
      <div className="-mt-2.5 size-5 rotate-45 bg-white" />
    </div>
  );
}

/*
  혼잡도를 점 색으로 보여 준다. 대기시간 표를 부스마다 달면 지도가 글씨로 덮이므로,
  급한 곳을 색으로 먼저 알아보고 자세한 시간은 눌러서 확인하게 한다.
*/
const CONGESTION_DOT_CLASSES: Record<CongestionLevel, string> = {
  LOW: "bg-secondary-600",
  MEDIUM: "bg-point-500",
  HIGH: "bg-red-600",
};

const CONGESTION_RING_CLASSES: Record<CongestionLevel, string> = {
  LOW: "bg-secondary-600/25",
  MEDIUM: "bg-point-500/25",
  HIGH: "bg-red-600/25",
};

/** 혼잡도를 아직 모르는 부스는 지금까지와 같은 포인트 색으로 둔다. */
function congestionDotClass(level: CongestionLevel | undefined) {
  return level ? CONGESTION_DOT_CLASSES[level] : "bg-point-600";
}

function congestionRingClass(level: CongestionLevel | undefined) {
  return level ? CONGESTION_RING_CLASSES[level] : "bg-point-600/25";
}

export function BoothMapView({
  booths,
  selectedBooth,
  onSelectBooth,
  facilities = [],
  zoomStep = 0,
  center,
  showPopup = true,
  queues = [],
  pamphlet = null,
  boundary = null,
  onZoomByWheel,
}: {
  booths: Booth[];
  /** 화장실·입구·출구 등 부스가 아닌 지도 시설. 아이콘으로만 표시하고 선택하지 않는다. */
  facilities?: FacilityMarker[];
  selectedBooth: Booth | null;
  onSelectBooth: (booth: Booth | null) => void;
  /** 기본 확대 수준(4)에 대한 상대값. 낮을수록 확대된다. */
  zoomStep?: number;
  center: { lat: number; lng: number };
  /** 마커를 누르면 상세 말풍선을 띄울지 여부. 선택 정보를 하단바로 보여주는 화면에서는 끈다. */
  showPopup?: boolean;
  queues?: QueuePathItem[];
  pamphlet?: LocalPamphletOverlay | null;
  boundary?: LatLng[] | null;
  onZoomByWheel?: (direction: 1 | -1) => void;
}) {
  const [loading, error] = useKakaoMapLoader();
  const [kakaoMap, setKakaoMap] = useState<kakao.maps.Map | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /*
    목록에서 부스를 고르면 그 부스가 화면 가운데로 오게 옮긴다. 목록은 왼쪽 패널이
    가리는 자리에 있는 부스도 보여 주므로, 눌러도 지도에서 어디인지 못 찾는 일이
    있었다. 지도 위 마커를 눌러 고른 경우에도 같은 자리로 모아 준다.
  */
  const selectedLat = selectedBooth?.lat;
  const selectedLng = selectedBooth?.lng;
  useEffect(() => {
    if (!kakaoMap || selectedLat === undefined || selectedLng === undefined) return;
    kakaoMap.panTo(new kakao.maps.LatLng(selectedLat, selectedLng));
  }, [kakaoMap, selectedLat, selectedLng]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!(event.ctrlKey || event.metaKey)) return;
      onZoomByWheel?.(event.deltaY > 0 ? 1 : -1);
    };
    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, [onZoomByWheel, loading, error]);

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className="absolute inset-0 isolate flex items-center justify-center border border-zinc-200 bg-zinc-50 px-4 text-center">
        <p className="body-small text-zinc-500">NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 isolate flex items-center justify-center border border-zinc-200 bg-zinc-50 px-4 text-center">
        <p className="body-small text-error">카카오맵을 불러오지 못했습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 isolate flex items-center justify-center border border-zinc-200 bg-zinc-50 px-4 text-center">
        <p className="body-small text-zinc-500">지도를 불러오는 중...</p>
      </div>
    );
  }

  // 좌표가 없는 부스는 지도에 찍을 수 없으므로 목록에서만 보여준다.
  const pinnedBooths = booths.filter(
    (booth): booth is Booth & { lat: number; lng: number } =>
      booth.lat !== undefined && booth.lng !== undefined,
  );
  const pinnedSelectedBooth =
    selectedBooth?.lat !== undefined && selectedBooth?.lng !== undefined
      ? (selectedBooth as Booth & { lat: number; lng: number })
      : null;

  return (
    <div ref={wrapperRef} className="absolute inset-0 isolate">
      <Map
        center={center}
        isPanto={false}
        level={2 + zoomStep}
        scrollwheel={false}
        className="h-full w-full"
        // react-kakao-maps-sdk의 minLevel/maxLevel prop은 내부적으로 서로 뒤바뀐 채
        // kakao.maps.Map.setMinLevel/setMaxLevel에 전달되는 버그가 있어(v1.2.1),
        // onCreate에서 직접 정확한 인자로 호출한다.
        onCreate={(map) => {
          setKakaoMap(map);
          map.setMinLevel(2);
          map.setMaxLevel(8);
        }}
      >
        <PamphletOverlay
          map={kakaoMap}
          imageUrl={pamphlet?.imageUrl ?? null}
          corners={pamphlet?.corners ?? null}
          boundary={boundary}
          clipToBoundary={Boolean(pamphlet?.clipToBoundary && boundary)}
          opacity={pamphlet?.opacity ?? 0.7}
          visible={Boolean(pamphlet?.visible)}
        />
        <QueuePathLayer queues={queues} />
        {boundary && boundary.length >= 3 ? (
          <Polygon
            path={boundary}
            fillColor="#18181b"
            fillOpacity={0.04}
            strokeColor="#18181b"
            strokeWeight={3}
            strokeOpacity={0.9}
          />
        ) : null}
        {/*
          시설 핀은 부스 핀보다 아래에 깔고 클릭도 받지 않는다. 혼잡도·대기열이 붙지 않아
          누를 것이 없고, 부스가 몰린 자리에서 선택을 가로채면 오히려 방해가 된다.
        */}
        {facilities.map((facility) => (
          <CustomOverlayMap
            key={facility.nodeId}
            position={{ lat: facility.lat, lng: facility.lng }}
            zIndex={5}
          >
            <span
              role="img"
              title={`${facility.name} (${nodeTypeLabel(facility.nodeType)})`}
              aria-label={`${facility.name} ${nodeTypeLabel(facility.nodeType)}`}
              className={PIN_ICON_CLASSES}
            >
              {nodeTypeIcon(facility.nodeType)}
            </span>
          </CustomOverlayMap>
        ))}
        {pinnedBooths.map((booth) => {
          const isSelected = selectedBooth?.boothId === booth.boothId;
          // 부스로 승인됐지만 지도에서 유형을 바꾼 노드는 그 유형 아이콘으로 그린다.
          const pinType = booth.nodeType ?? "BOOTH";
          const isIconPin = pinType !== "BOOTH";
          return (
            <CustomOverlayMap
              key={booth.boothId}
              position={{ lat: booth.lat, lng: booth.lng }}
              clickable
              zIndex={isSelected ? 20 : 10}
            >
              <button
                type="button"
                title={booth.name}
                aria-label={booth.name}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBooth(isSelected ? null : booth);
                }}
                className={`flex items-center justify-center ${isIconPin ? "size-5" : "size-3"}`}
              >
                {isIconPin ? (
                  <span
                    className={`${PIN_ICON_CLASSES} ${isSelected ? "ring-2 ring-point-600/40" : ""}`}
                  >
                    {nodeTypeIcon(pinType)}
                  </span>
                ) : isSelected ? (
                  <span
                    className={`flex size-3 items-center justify-center rounded-full ${congestionRingClass(booth.congestionLevel)}`}
                  >
                    <span
                      className={`size-1 rounded-full ${congestionDotClass(booth.congestionLevel)}`}
                    />
                  </span>
                ) : (
                  <span
                    className={`size-3 rounded-full shadow-sm ${congestionDotClass(booth.congestionLevel)}`}
                  />
                )}
              </button>
            </CustomOverlayMap>
          );
        })}

        {showPopup && pinnedSelectedBooth ? (
          <CustomOverlayMap
            position={{ lat: pinnedSelectedBooth.lat, lng: pinnedSelectedBooth.lng }}
            yAnchor={1}
            zIndex={30}
          >
            <BoothPopup booth={pinnedSelectedBooth} onClose={() => onSelectBooth(null)} />
          </CustomOverlayMap>
        ) : null}
      </Map>
    </div>
  );
}
