import { adminApiClient } from "@/lib/api/adminApiClient";
import type { ApiResponse } from "@/lib/api/types";
import { isAxiosError } from "axios";
import type {
  CreateCoordinateMapRequest,
  CreateCoordinateMapResponse,
  FestivalMapReadUrlResponse,
  FestivalMapSummary,
  MapAnalysisStatusResponse,
  MapEditorResponse,
  SaveRoadmapDraftRequest,
  ApproveBoothsResponse,
  SaveRoadmapDraftResponse,
} from "./types";

export async function uploadMapOverlay(festivalId: string, mapId: string, image: File) {
  const form = new FormData();
  form.append("image", image);
  const { data } = await adminApiClient.post<
    ApiResponse<{
      assetId: string;
      imageUrl: string;
      imageUrlExpiresAt?: string | null;
      imageWidth: number;
      imageHeight: number;
    }>
  >(`/festivals/${festivalId}/maps/${mapId}/overlay`, form);
  return data.data;
}

export async function createCoordinateMap(
  festivalId: string,
  request: CreateCoordinateMapRequest,
): Promise<CreateCoordinateMapResponse> {
  const { data } = await adminApiClient.post<ApiResponse<CreateCoordinateMapResponse>>(
    `/festivals/${festivalId}/maps`,
    request,
  );
  return data.data;
}

export async function getCurrentMap(festivalId: string): Promise<CreateCoordinateMapResponse> {
  const { data } = await adminApiClient.get<ApiResponse<CreateCoordinateMapResponse>>(
    `/festivals/${festivalId}/maps/current`,
  );
  return data.data;
}

/** 현재 map이 있으면 조회하고, 없으면 좌표 전용 map을 준비한다. */
export async function ensureCoordinateMap(
  festivalId: string,
  mapName = "본행사 배치",
): Promise<CreateCoordinateMapResponse> {
  try {
    return await getCurrentMap(festivalId);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return createCoordinateMap(festivalId, { mapName });
    }
    throw error;
  }
}

export async function getMapAnalysisStatus(
  festivalId: string,
  mapId: string,
): Promise<MapAnalysisStatusResponse> {
  const { data } = await adminApiClient.get<ApiResponse<MapAnalysisStatusResponse>>(
    `/festivals/${festivalId}/maps/${mapId}/analysis`,
  );
  return data.data;
}

export async function getMapEditor(festivalId: string, mapId: string): Promise<MapEditorResponse> {
  const { data } = await adminApiClient.get<ApiResponse<MapEditorResponse>>(
    `/festivals/${festivalId}/maps/${mapId}/editor`,
  );
  return data.data;
}

export async function saveMapEditor(
  festivalId: string,
  mapId: string,
  request: SaveRoadmapDraftRequest,
): Promise<SaveRoadmapDraftResponse> {
  const { data } = await adminApiClient.put<ApiResponse<SaveRoadmapDraftResponse>>(
    `/festivals/${festivalId}/maps/${mapId}/editor`,
    request,
  );
  return data.data;
}

export async function getMapReadUrl(
  festivalId: string,
  mapId: string,
): Promise<FestivalMapReadUrlResponse> {
  const { data } = await adminApiClient.get<ApiResponse<FestivalMapReadUrlResponse>>(
    `/festivals/${festivalId}/maps/${mapId}/read-url`,
  );
  return data.data;
}

export async function replaceFestivalMap(
  festivalId: string,
  mapId: string,
  image: File,
  mapName?: string,
): Promise<FestivalMapSummary> {
  const form = new FormData();
  if (mapName) form.append("mapName", mapName);
  form.append("image", image);
  const { data } = await adminApiClient.post<ApiResponse<FestivalMapSummary>>(
    `/festivals/${festivalId}/maps/${mapId}/replacement`,
    form,
  );
  return data.data;
}

export async function deleteFestivalMap(festivalId: string, mapId: string): Promise<void> {
  await adminApiClient.delete<ApiResponse<void>>(`/festivals/${festivalId}/maps/${mapId}`);
}

/**
 * 지도에 찍은 부스 노드를 한 번에 운영 부스로 승인한다.
 *
 * 지도만 저장하면 노드는 생기지만 운영 부스(booth_info)가 없어 대시보드가 «부스 0개»로
 * 보인다. 이미 승인된 노드와 부스가 아닌 노드는 서버가 조용히 건너뛴다.
 */
export async function approveBooths(
  festivalId: string,
  mapId: string,
): Promise<ApproveBoothsResponse> {
  const { data } = await adminApiClient.post<ApiResponse<ApproveBoothsResponse>>(
    `/festivals/${festivalId}/maps/${mapId}/approve-booths`,
  );
  return data.data;
}
