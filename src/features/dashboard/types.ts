import type { MapPresentation } from "@/features/boothmap/types";
export type CongestionLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Booth {
  boothId: string;
  /** 이 부스의 대기열(줄) 식별자. 대기열 조회를 하지 않는 화면에서는 비어 있다. */
  queueId?: string;
  name: string;
  zoneId: string;
  /** Kakao 지도 위 부스 핀 좌표. 좌표가 등록되지 않은 부스는 비어 있다. */
  lat?: number;
  lng?: number;
  congestionLevel?: CongestionLevel;
  /** 예상 대기 시간(분). */
  waitMinutes?: number;
  /** 혼잡도 정보가 마지막으로 갱신된 시각(분 전). */
  updatedMinutesAgo?: number;
  /** 혼잡도가 마지막으로 갱신된 시각(ISO-8601). */
  congestionUpdatedAt?: string;
  /** 대기열 끝(줄끝)을 마지막으로 갱신한 사람. */
  lastQueueUpdater?: { name: string; role: ModifierType };
  /** 줄끝 갱신 시 선택 가능한 구역(존) 목록. */
  queueZones?: string[];
}

export interface BoothZone {
  zoneId: string;
  name: string;
  booths: Booth[];
}

export interface DashboardSummary {
  overallCongestion: CongestionLevel;
  estimatedWaitMinutes: number;
  busiestBoothName: string;
  dailyVisitorCount: number;
  totalVisitorCount: number;
}

export interface AiSuggestion {
  id: string;
  title: string;
  description: string;
  /** 제안 내용을 지도 위에 경로선으로 보여줄 때의 경유 좌표(있을 때만 그린다). */
  path?: { lat: number; lng: number }[];
}

export interface FestivalCongestion {
  festivalId: string;
  updatedAt: string | null;
  activeQueueCount: number;
  averageWaitMinutes: number;
  booths: Array<{
    boothId: number;
    boothName: string;
    congestionLevel: CongestionLevel;
    waitMinutes: number;
    updatedAt: string;
  }>;
}

export interface FestivalOperationSuggestions {
  suggestions: Array<{
    suggestionId: string;
    title: string;
    description: string;
    path: Array<{ lat: number; lng: number }>;
  }>;
}

export interface FestivalDashboard {
  festivalId: string;
  festivalName: string;
  dataAvailable: boolean;
  visitorAvailable: boolean;
  boothAvailable: boolean;
  congestionAvailable: boolean;
  summaryAvailable: boolean;
  operatingStatus: string;
  currentVisitorCount: number | null;
  activeQueueCount: number | null;
  averageWaitMinutes: number | null;
  updatedAt: string | null;
  booths: DashboardBooth[];
  /** 로드맵 구역 목록. 좌표 전용 지도라 구역을 나누지 않았으면 빈 배열이다. */
  zones: DashboardZone[];
}

/** 혼잡도를 마지막으로 갱신한 주체의 종류. */
export type ModifierType = "ADMIN" | "STAFF";

export interface DashboardBooth {
  boothId: number;
  boothName: string;
  /** 구역(zone) 매칭에 쓰는 로드맵 노드 식별자. 좌표가 없는 부스는 null이다. */
  roadmapNodePublicId: string | null;
  lat: number | null;
  lng: number | null;
  congestionLevel: CongestionLevel | null;
  waitMinutes: number | null;
  congestionUpdatedAt: string | null;
  modifierType: ModifierType | null;
  modifierAdminId: number | null;
  modifierStaffId: number | null;
  modifierName: string | null;
}

export interface DashboardZone {
  zoneId: string;
  name: string;
  sortOrder: number;
  boothNodeIds: string[];
}

/**
 * 현장 운영 지도 조회(`GET /festivals/{festivalId}/operations/map`) 응답.
 *
 * 대시보드는 편집기 API(`.../maps/{mapId}/editor`)를 부르지 않는다. 그쪽은 총괄관리자
 * 전용 편집 계약이라 운영자에게는 권한이 없고, 초안 노드까지 통째로 내려온다.
 */
export interface FestivalOperationsMap {
  mapId: string;
  editRevision: number;
  mapKind?: string | null;
  presentation?: MapPresentation | null;
  booths: {
    boothId: number;
    nodeId: string | null;
    name: string;
    lat: number;
    lng: number;
  }[];
}
