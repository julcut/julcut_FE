import { adminApiClient } from "@/lib/api/adminApiClient";
import type { ApiResponse } from "@/lib/api/types";
import type {
  FestivalQueue,
  FestivalQueueList,
  UpdateQueueTailRequest,
} from "@/features/staffMap/types";
import type { FestivalCongestion, FestivalDashboard, FestivalOperationSuggestions } from "./types";

export async function getFestivalDashboard(festivalId: string): Promise<FestivalDashboard> {
  const { data } = await adminApiClient.get<ApiResponse<FestivalDashboard>>(
    `/festivals/${festivalId}/dashboard`,
  );
  return data.data;
}

export async function getFestivalCongestion(festivalId: string): Promise<FestivalCongestion> {
  const { data } = await adminApiClient.get<ApiResponse<FestivalCongestion>>(
    `/festivals/${festivalId}/operations/congestion`,
  );
  return data.data;
}

export async function getFestivalOperationSuggestions(
  festivalId: string,
): Promise<FestivalOperationSuggestions> {
  const { data } = await adminApiClient.get<ApiResponse<FestivalOperationSuggestions>>(
    `/festivals/${festivalId}/operations/suggestions`,
  );
  return data.data;
}

export async function getFestivalQueues(festivalId: string): Promise<FestivalQueueList> {
  const { data } = await adminApiClient.get<ApiResponse<FestivalQueueList>>(
    `/festivals/${festivalId}/operations/queues`,
  );
  return data.data;
}

/**
 * 관리자 권한으로 부스의 줄끝 위치를 갱신한다.
 * 스태프 앱의 같은 이름 함수와 엔드포인트는 같지만 관리자 토큰으로 호출해야 해서
 * `adminApiClient`를 쓰는 별도 함수로 둔다. 백엔드는 이 경로를 ADMIN·FIELD_STAFF
 * 양쪽에 열어 두고, 관리자는 해당 축제에 배정된 역할이 있으면 통과한다.
 */
export async function updateQueueTailAsAdmin(
  festivalId: string,
  queueId: string,
  request: UpdateQueueTailRequest,
): Promise<FestivalQueue> {
  const { data } = await adminApiClient.patch<ApiResponse<FestivalQueue>>(
    `/festivals/${festivalId}/operations/queues/${queueId}`,
    request,
  );
  return data.data;
}
