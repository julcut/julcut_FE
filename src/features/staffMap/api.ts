import type { FestivalDashboard, FestivalOperationsMap } from "@/features/dashboard/types";
import { staffApiClient } from "@/lib/api/staffApiClient";
import type { ApiResponse } from "@/lib/api/types";
import type { FestivalQueue, FestivalQueueList, UpdateQueueTailRequest } from "./types";

/** 담당 축제의 부스·구역·혼잡도를 한 번에 가져온다(스태프 토큰으로도 조회 가능). */
export async function getStaffFestivalDashboard(festivalId: string): Promise<FestivalDashboard> {
  const { data } = await staffApiClient.get<ApiResponse<FestivalDashboard>>(
    `/festivals/${festivalId}/dashboard`,
  );
  return data.data;
}

export async function getFestivalQueues(festivalId: string): Promise<FestivalQueueList> {
  const { data } = await staffApiClient.get<ApiResponse<FestivalQueueList>>(
    `/festivals/${festivalId}/operations/queues`,
  );
  return data.data;
}

export async function updateQueueTail(
  festivalId: string,
  queueId: string,
  request: UpdateQueueTailRequest,
): Promise<FestivalQueue> {
  const { data } = await staffApiClient.patch<ApiResponse<FestivalQueue>>(
    `/festivals/${festivalId}/operations/queues/${queueId}`,
    request,
  );
  return data.data;
}

/**
 * 현장 운영 지도(부지 경계·팜플렛·승인 부스).
 * 대시보드의 같은 이름 함수와 엔드포인트는 같지만 스태프 토큰으로 호출해야 해서
 * `staffApiClient`를 쓰는 별도 함수로 둔다. 백엔드는 이 경로를 ADMIN·FIELD_STAFF
 * 양쪽에 열어 두고, 스태프는 배정된 축제일 때만 통과한다.
 */
export async function getStaffFestivalOperationsMap(
  festivalId: string,
): Promise<FestivalOperationsMap> {
  const { data } = await staffApiClient.get<ApiResponse<FestivalOperationsMap>>(
    `/festivals/${festivalId}/operations/map`,
  );
  return data.data;
}
