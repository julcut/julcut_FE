/**
 * 백엔드 지도 노드 편집 API(`GET/PUT /api/festivals/{festivalId}/maps/{mapId}/editor`)의
 * enum/geometry 스키마. 값은 `demoAdmin_BE`의
 * `map/roadmap/domain/{NodeType,GeometryType}.java`, `map/analysis/domain/MapAnalysisJobStatus.java`,
 * `map/analysis/application/MapGeometryValidator.java`(geometry 필드 검증 규칙)를 직접 읽고 옮겼다.
 */
export type NodeType =
  | "BOOTH"
  | "STAGE"
  | "RESTROOM"
  | "ENTRANCE"
  | "EXIT"
  | "PATH"
  | "BUILDING"
  | "OPEN_SPACE"
  | "PARKING"
  | "INFORMATION"
  | "QUEUE"
  | "OTHER";

export type GeometryType = "RECTANGLE" | "POINT" | "POLYGON" | "POLYLINE";

export type RoadmapStatus = "ANALYZING" | "REVIEW_REQUIRED" | "EDITING" | "PUBLISHED";

export type NodeReviewStatus = "REVIEW_REQUIRED" | "CONFIRMED";

export type NodeSource = "AI" | "ADMIN";

export type MapAnalysisJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

/** IMAGE map(schema 1.0): geometry는 이미지 대비 0~1 정규화 값이다. */
export type RectangleGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};
export type PointGeometry = { x: number; y: number };
export type PointGeometryWgs84 = { lat: number; lng: number };
export type PolyGeometry = { points: { x: number; y: number }[] };
export type PolyGeometryWgs84 = { points: { lat: number; lng: number }[] };
export type NodeGeometry = RectangleGeometry | PointGeometry | PolyGeometry;

export interface NodeResponse {
  nodeId: string;
  nodeType: NodeType;
  name: string;
  geometryType: GeometryType;
  geometry: Record<string, unknown>;
  confidence: number | null;
  recognizedText: string | null;
  source: NodeSource;
  reviewStatus: NodeReviewStatus;
  sortOrder: number;
  geometrySchemaVersion?: string;
}

export interface MapAnalysisStatusResponse {
  jobId: string;
  status: MapAnalysisJobStatus;
  attemptCount: number;
  detectedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * 배치도 이미지를 실세계 좌표에 고정하는 기준값.
 * 이미지 중심 위경도 + 이미지 가로폭이 덮는 실거리(m) + 이미지 위쪽 방위각(북=0, 시계방향).
 * 앵커가 없으면 응답에서 키 자체가 빠진다(백엔드가 NON_NULL 직렬화).
 */
export interface MapImageAnchor {
  centerLat: number;
  centerLng: number;
  groundWidthMeters: number;
  rotationDegrees: number;
}

export type UpdateMapImageAnchorRequest = MapImageAnchor;

export interface UpdateMapImageAnchorResponse extends MapImageAnchor {
  mapId: string;
}

export interface MapEditorResponse {
  mapId: string;
  displayImageUrl?: string | null;
  displayImageUrlExpiresAt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  editRevision: number;
  roadmapStatus: RoadmapStatus;
  analysis?: MapAnalysisStatusResponse | null;
  nodes: NodeResponse[];
  zones?: RoadmapZoneResponse[];
  center?: { lat: number; lng: number } | null;
  imageAnchor?: MapImageAnchor | null;
}

export interface CreateCoordinateMapResponse {
  mapId: string;
  mapName: string;
  editRevision: number;
  roadmapStatus: RoadmapStatus;
  center: { lat: number; lng: number };
}

export interface CreateCoordinateMapRequest {
  mapName: string;
}

export interface NodeChangeRequest {
  nodeId: string | null;
  clientNodeId?: string | null;
  nodeType: NodeType;
  name: string;
  geometryType: GeometryType;
  geometry: Record<string, unknown>;
  deleted: boolean;
  sortOrder: number;
}

export interface RoadmapZoneResponse {
  zoneId: string;
  name: string;
  sortOrder: number;
  boothNodeIds: string[];
}

export interface RoadmapZoneChangeRequest {
  zoneId: string | null;
  name: string;
  sortOrder: number;
  boothNodeIds: string[];
}

export interface SaveRoadmapDraftRequest {
  baseRevision: number;
  nodes: NodeChangeRequest[];
  zones?: RoadmapZoneChangeRequest[];
}

export interface SaveRoadmapDraftResponse {
  editRevision: number;
}

/** 축제 생성/도면 교체 응답에 담기는 배치도 요약 정보. */
export interface FestivalMapSummary {
  mapId: string;
  mapName: string;
  storageStatus: string;
  imageWidth: number;
  imageHeight: number;
  analysisJobId: string | null;
  analysisStatus: MapAnalysisJobStatus | null;
}

export interface FestivalMapReadUrlResponse {
  readUrl: string;
  expiresAt: string;
}

/**
 * 사각형(또는 사각형으로 근사한 점)으로 표현하는 시설 — 부스, 무대, 건물 등.
 * `QUEUE`(대기열)만 제외한 모든 NodeType이 여기 해당한다. `nodeId`가 있으면
 * 서버에 이미 존재하는 노드(수정 대상), 없으면 이 화면에서 새로 만든 노드다.
 */
export type BoothMapShapeType = Exclude<NodeType, "QUEUE">;

export interface BoothMapShape {
  kind: "shape";
  /** 캔버스 내부 식별자(로컬). 서버 노드와의 연결은 nodeId로 한다. */
  id: string;
  nodeId: string | null;
  type: BoothMapShapeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** AI가 인식한 노드인지, 그중 검수가 끝났는지. 서버가 내려준 값을 그대로 표시만 한다. */
  reviewStatus?: NodeReviewStatus;
  source?: NodeSource;
}

/** 대기 라인(줄) — 클릭으로 점을 찍어 만드는 꺾은선. 서버의 QUEUE 노드(POLYLINE)에 대응한다. */
export interface BoothMapQueueLine {
  kind: "line";
  id: string;
  nodeId: string | null;
  label: string;
  /** Konva Line이 바로 쓸 수 있는 평탄화 좌표 [x1, y1, x2, y2, ...] (캔버스 픽셀 기준) */
  points: number[];
  reviewStatus?: NodeReviewStatus;
  source?: NodeSource;
}

export type BoothMapObject = BoothMapShape | BoothMapQueueLine;
