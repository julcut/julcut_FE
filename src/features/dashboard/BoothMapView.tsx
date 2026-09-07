"use client";

import { Map, CustomOverlayMap } from "react-kakao-maps-sdk";
import { Cross2Icon } from "@radix-ui/react-icons";
import { IconButton } from "@/components/ui/IconButton";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import type { Booth } from "./types";

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
            예상 대기시간 {booth.waitMinutes == null ? "미입력" : `${booth.waitMinutes}분`}
          </p>
        </div>
      </div>
      <div className="-mt-2.5 size-5 rotate-45 bg-white" />
    </div>
  );
}

export function BoothMapView({
  booths,
  selectedBooth,
  onSelectBooth,
  zoomStep = 0,
  center,
  showPopup = true,
}: {
  booths: Booth[];
  selectedBooth: Booth | null;
  onSelectBooth: (booth: Booth | null) => void;
  /** 기본 확대 수준(4)에 대한 상대값. 낮을수록 확대된다. */
  zoomStep?: number;
  center: { lat: number; lng: number };
  /** 마커를 누르면 상세 말풍선을 띄울지 여부. 선택 정보를 하단바로 보여주는 화면에서는 끈다. */
  showPopup?: boolean;
}) {
  const [loading, error] = useKakaoMapLoader();

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
    <Map
      center={center}
      isPanto={false}
      level={2 + zoomStep}
      scrollwheel={false}
      className="absolute inset-0 isolate"
      // react-kakao-maps-sdk의 minLevel/maxLevel prop은 내부적으로 서로 뒤바뀐 채
      // kakao.maps.Map.setMinLevel/setMaxLevel에 전달되는 버그가 있어(v1.2.1),
      // onCreate에서 직접 정확한 인자로 호출한다.
      onCreate={(map) => {
        map.setMinLevel(2);
        map.setMaxLevel(8);
      }}
    >
      {pinnedBooths.map((booth) => {
        const isSelected = selectedBooth?.boothId === booth.boothId;
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
              className="flex size-3 items-center justify-center"
            >
              {isSelected ? (
                <span className="flex size-3 items-center justify-center rounded-full bg-point-600/25">
                  <span className="size-1 rounded-full bg-point-600" />
                </span>
              ) : (
                <span className="size-3 rounded-full bg-point-600 shadow-sm" />
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
  );
}
