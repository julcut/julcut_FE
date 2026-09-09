import type { CongestionLevel, ModifierType } from "@/features/dashboard/types";

export interface QueuePathPoint {
  lat: number;
  lng: number;
}

/** 부스 하나의 대기열(줄) 상태. */
export interface FestivalQueue {
  queueId: string;
  boothId: number;
  boothName: string;
  tailLatitude: number | null;
  tailLongitude: number | null;
  /** 부스에서 줄끝까지의 거리(m). */
  queueTailMeters: number | null;
  path: QueuePathPoint[] | null;
  lastModifierType: ModifierType | null;
  /** 마지막으로 줄끝을 갱신한 사람의 이름. */
  lastModifierName: string | null;
  updatedAt: string | null;
}

export interface FestivalQueueList {
  festivalId: string;
  queues: FestivalQueue[];
}

export interface UpdateQueueTailRequest {
  tailLatitude: number;
  tailLongitude: number;
  queueTailMeters?: number;
  path?: QueuePathPoint[];
}

/**
 * 스태프가 직접 정한 혼잡도.
 *
 * 줄끝 갱신만 하면 서버가 줄 길이로 등급과 대기시간을 자동 환산하는데, 현장에서는
 * 줄 길이만으로 설명되지 않는 상황(조리 지연, 일시 중단 등)이 있어 직접 덮어쓸 수 있다.
 */
export interface UpdateBoothCongestionRequest {
  /** 예상 대기시간(분). 0 이상이어야 한다. */
  waitMinutes: number;
  congestionLevel: CongestionLevel;
}
