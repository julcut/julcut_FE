import { adminApiClient } from "@/lib/api/adminApiClient";
import type { ApiResponse } from "@/lib/api/types";
import type {
  RegisterOperatorRequest,
  RegisterOperatorResult,
  SubAdmin,
  SubAdminCandidate,
} from "./types";

export async function getSubAdmins(festivalId: string, keyword?: string): Promise<SubAdmin[]> {
  const { data } = await adminApiClient.get<ApiResponse<SubAdmin[]>>(
    `/festivals/${festivalId}/sub-admins`,
    { params: keyword ? { keyword } : undefined },
  );
  return data.data;
}

export async function getSubAdmin(festivalId: string, adminId: string): Promise<SubAdmin> {
  const { data } = await adminApiClient.get<ApiResponse<SubAdmin>>(
    `/festivals/${festivalId}/sub-admins/${adminId}`,
  );
  return data.data;
}

/**
 * 아직 이 축제에 배정되지 않은 활성 관리자 계정을 이름·이메일로 검색한다.
 * 화면설계서(7-1 운영자관리 - 검색/추가)의 검색 인풋이 호출하는 API다.
 */
export async function searchSubAdminCandidates(
  festivalId: string,
  keyword: string,
): Promise<SubAdminCandidate[]> {
  const { data } = await adminApiClient.get<ApiResponse<SubAdminCandidate[]>>(
    `/festivals/${festivalId}/sub-admin-candidates`,
    { params: { keyword } },
  );
  return data.data;
}

/** 검색 결과에서 고른 관리자 계정을 이 축제의 운영자로 배정한다. */
export async function assignSubAdmin(festivalId: string, adminId: string): Promise<void> {
  await adminApiClient.post<ApiResponse<void>>(`/festivals/${festivalId}/sub-admins`, { adminId });
}

/**
 * 아직 관리자 계정이 없는 사람을 운영자로 추가한다(계정 생성 + 임시 비밀번호 발급).
 * 검색 결과가 없을 때만 쓰는 보조 경로다.
 */
export async function registerOperator(
  festivalId: string,
  request: RegisterOperatorRequest,
): Promise<RegisterOperatorResult> {
  const { data } = await adminApiClient.post<ApiResponse<RegisterOperatorResult>>(
    `/festivals/${festivalId}/operators`,
    request,
  );
  return data.data;
}

export async function deleteSubAdmins(festivalId: string, adminIds: string[]): Promise<void> {
  await adminApiClient.delete<ApiResponse<void>>(`/festivals/${festivalId}/sub-admins`, {
    data: { adminIds },
  });
}
