import type { FestivalLocationRequest, FestivalLocationType } from "./types";

/** 다중 장소 입력 화면에서 편집 중인 장소 한 칸. 서버에는 없는 화면 전용 key를 갖는다. */
export interface LocationDraft {
  key: string;
  locationType: FestivalLocationType;
  locationName: string;
  roadAddress: string;
  detailAddress: string;
  latitude?: number;
  longitude?: number;
}

function createDraftKey() {
  return `location-${Math.random().toString(36).slice(2, 9)}`;
}

export function createLocationDraft(
  locationType: FestivalLocationType = "SUB_VENUE",
  locationName = "",
): LocationDraft {
  return {
    key: createDraftKey(),
    locationType,
    locationName,
    roadAddress: "",
    detailAddress: "",
    latitude: undefined,
    longitude: undefined,
  };
}

export function createInitialLocationDrafts(): LocationDraft[] {
  return [
    {
      key: createDraftKey(),
      locationType: "MAIN_VENUE",
      locationName: "메인 행사장",
      roadAddress: "",
      detailAddress: "",
      latitude: undefined,
      longitude: undefined,
    },
  ];
}

/** 이름/주소가 모두 채워졌는지 — 등록 제출 전 검증에 쓴다. */
export function isLocationDraftComplete(draft: LocationDraft) {
  return draft.locationName.trim().length > 0 && draft.roadAddress.trim().length > 0;
}

/**
 * 위경도가 채워졌는지. 백엔드는 좌표 없는 장소를 거절하고, 좌표가 없으면
 * 부스맵(ensureCoordinateMap)도 만들 수 없어 등록 제출 전에 반드시 확인해야 한다.
 */
export function hasLocationDraftCoordinate(draft: LocationDraft) {
  // NaN까지 걸러낸다. 카카오 검색 결과의 x/y를 Number()로 바꾸다 실패하면 NaN이 되는데,
  // 그대로 두면 JSON에서 null로 실려 나가 백엔드에서 좌표 없음과 똑같이 거절당한다.
  return Number.isFinite(draft.latitude) && Number.isFinite(draft.longitude);
}

export function toFestivalLocationRequests(
  drafts: LocationDraft[],
  primaryKey: string,
): FestivalLocationRequest[] {
  return drafts.map((draft, index) => ({
    locationType: draft.locationType,
    locationName: draft.locationName,
    roadAddress: draft.roadAddress,
    detailAddress: draft.detailAddress || undefined,
    latitude: draft.latitude,
    longitude: draft.longitude,
    primary: draft.key === primaryKey,
    sortOrder: index,
  }));
}
