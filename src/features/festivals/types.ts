import type { FestivalMapSummary } from "@/features/boothmap/types";

export type FestivalLocationType =
  | "MAIN_VENUE"
  | "SUB_VENUE"
  | "STAGE_AREA"
  | "EXPERIENCE_AREA"
  | "PARKING"
  | "SHUTTLE_STOP"
  | "ENTRANCE"
  | "OPERATING_AREA"
  | "OTHER";

export type FestivalLocationSourceType = "MANUAL" | "API";
export type FestivalVisitorCountInputMode = "DAILY" | "TOTAL";

export const FESTIVAL_LOCATION_TYPE_LABEL: Record<FestivalLocationType, string> = {
  MAIN_VENUE: "메인 행사장",
  SUB_VENUE: "부속 행사장",
  STAGE_AREA: "무대/공연 구역",
  EXPERIENCE_AREA: "체험 구역",
  PARKING: "주차장",
  SHUTTLE_STOP: "셔틀 정류장",
  ENTRANCE: "출입구",
  OPERATING_AREA: "운영 구역",
  OTHER: "기타",
};

export interface FestivalLocationRequest {
  /** 수정할 기존 장소 UUID. 신규 장소는 생략(undefined). */
  locationId?: string;
  locationType: FestivalLocationType;
  locationName: string;
  roadAddress?: string;
  jibunAddress?: string;
  detailAddress?: string;
  postalCode?: string;
  buildingManagementNumber?: string;
  latitude?: number;
  longitude?: number;
  boundaryGeometry?: Record<string, unknown>;
  primary: boolean;
  sortOrder: number;
}

export interface FestivalLocationResponse {
  locationId: string;
  locationType: FestivalLocationType;
  locationName: string;
  roadAddress: string | null;
  jibunAddress: string | null;
  detailAddress: string | null;
  postalCode: string | null;
  buildingManagementNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  boundaryGeometry: Record<string, unknown> | null;
  sourceType: FestivalLocationSourceType;
  primary: boolean;
  sortOrder: number;
}

export interface CreateFestivalRequest {
  /** 기존 축제 묶음 UUID. 없으면 축제명 기준으로 자동 생성 또는 연결 */
  seriesId?: string;
  name: string;
  description: string;
  /** 축제 장소 목록. 최소 1개, 그중 하나는 primary=true여야 한다. */
  locations: FestivalLocationRequest[];
  /** yyyy-MM-dd */
  startDate: string;
  /** yyyy-MM-dd */
  endDate: string;
  /** HH:mm:ss */
  operationStartTime: string;
  /** HH:mm:ss */
  operationEndTime: string;
  /** 생략하면 미설정 상태로 등록한다. */
  visitorCountInputMode?: FestivalVisitorCountInputMode;
}

export interface CreateFestivalResponse {
  festivalId: string;
  seriesId: string;
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  operationStartTime: string;
  operationEndTime: string;
  locations: FestivalLocationResponse[];
}

export interface CreateFestivalWithMapResponse {
  festival: CreateFestivalResponse;
  map: FestivalMapSummary;
}

export interface ManagedFestivalDetail {
  festivalId: string;
  seriesId: string;
  festivalName: string | null;
  description: string | null;
  festivalYear: number;
  role: "FESTIVAL_OWNER" | "SUB_ADMIN";
  festivalStatus: "DRAFT" | "PUBLISHED" | "CANCELLED";
  progressStatus: "UPCOMING" | "ONGOING" | "COMPLETED";
  address: string | null;
  detailAddress: string | null;
  startDate: string | null;
  endDate: string | null;
  operationStartTime: string | null;
  operationEndTime: string | null;
  visitorCountInputMode: "UNSET" | FestivalVisitorCountInputMode;
  locations: FestivalLocationResponse[];
}

/**
 * 축제 기본 정보 수정 요청. `locations`는 전체 치환이므로 항상 전체 목록을 보내야 한다.
 * 방문 인원 집계 방식은 여기서 바꾸지 않고 `updateFestivalVisitorCountInputMode`를 쓴다.
 */
export interface UpdateFestivalRequest extends Omit<
  CreateFestivalRequest,
  "seriesId" | "visitorCountInputMode" | "operationStartTime" | "operationEndTime"
> {
  /** 두 시간 모두 생략하면 기존 운영시간을 유지한다. */
  operationStartTime?: string;
  operationEndTime?: string;
}

/** 방문 인원 집계 방식 전용 변경 API의 응답. */
export interface FestivalVisitorCountInputModeResponse {
  festivalId: string;
  visitorCountInputMode: FestivalVisitorCountInputMode;
}

/** "축제 등록" 화면에서 축제명으로 기존 축제 시리즈를 검색한 결과 한 건. */
export interface FestivalSeriesSearchResult {
  seriesId: string;
  name: string;
  latestFestivalId: string;
  latestYear: number;
  latestDescription: string;
  latestAddress: string;
  latestDetailAddress: string;
  /** yyyy-MM-dd */
  latestStartDate: string;
  /** yyyy-MM-dd */
  latestEndDate: string;
  /** HH:mm:ss */
  latestOperationStartTime: string;
  /** HH:mm:ss */
  latestOperationEndTime: string;
}
