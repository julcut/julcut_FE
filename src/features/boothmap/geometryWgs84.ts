import type { NodeChangeRequest, NodeResponse, NodeType } from "./types";

/** 카카오맵 위에 표시하는 부스 핀(로컬 UI 상태). */
export interface LocalBoothPin {
  id: string;
  nodeId: string | null;
  name: string;
  nodeType: NodeType;
  lat: number;
  lng: number;
  uncertain?: boolean;
  isNew?: boolean;
}

/** schema 2.0 POINT 노드만 카카오 핀으로 변환한다. 1.0(이미지 정규화)은 null. */
export function nodeToLocalBooth(node: NodeResponse): LocalBoothPin | null {
  if (node.geometrySchemaVersion === "1.0") {
    return null;
  }
  if (node.geometryType !== "POINT") {
    return null;
  }
  const lat = node.geometry.lat;
  const lng = node.geometry.lng;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  return {
    id: `node-${node.nodeId}`,
    nodeId: node.nodeId,
    name: node.name,
    nodeType: node.nodeType,
    lat,
    lng,
    uncertain: node.reviewStatus === "REVIEW_REQUIRED",
    isNew: false,
  };
}

/** 카카오맵 위에 직접 그리는 자유 도형(폴리곤·라인). 서버의 POLYGON/POLYLINE 노드에 대응한다. */
export interface LocalMapShape {
  id: string;
  nodeId: string | null;
  name: string;
  nodeType: NodeType;
  kind: "polygon" | "line";
  points: { lat: number; lng: number }[];
  isNew?: boolean;
}

/** 폴리곤은 3점, 라인은 2점 이상이어야 서버가 받는다(MapGeometryValidator). */
export const SHAPE_MINIMUM_POINTS: Record<LocalMapShape["kind"], number> = {
  polygon: 3,
  line: 2,
};

/** schema 2.0 POLYGON/POLYLINE 노드를 지도 위 도형으로 변환한다. 그 밖의 노드는 null. */
export function nodeToLocalShape(node: NodeResponse): LocalMapShape | null {
  if (node.geometrySchemaVersion === "1.0") {
    return null;
  }
  if (node.geometryType !== "POLYGON" && node.geometryType !== "POLYLINE") {
    return null;
  }
  const rawPoints = node.geometry.points;
  if (!Array.isArray(rawPoints)) {
    return null;
  }
  const points = rawPoints.flatMap((point) => {
    const lat = (point as { lat?: unknown })?.lat;
    const lng = (point as { lng?: unknown })?.lng;
    return typeof lat === "number" && typeof lng === "number" ? [{ lat, lng }] : [];
  });
  const kind = node.geometryType === "POLYGON" ? "polygon" : "line";
  if (points.length < SHAPE_MINIMUM_POINTS[kind]) {
    return null;
  }
  return {
    id: `node-${node.nodeId}`,
    nodeId: node.nodeId,
    name: node.name,
    nodeType: node.nodeType,
    kind,
    points,
    isNew: false,
  };
}

export function boothMapPinsToNodeChanges(
  booths: LocalBoothPin[],
  deletedNodeIds: string[],
  shapes: LocalMapShape[] = [],
): NodeChangeRequest[] {
  const changes: NodeChangeRequest[] = booths.map((booth, index) => ({
    nodeId: booth.nodeId,
    clientNodeId: booth.nodeId ? null : booth.id,
    nodeType: booth.nodeType,
    name: booth.name,
    geometryType: "POINT",
    geometry: { lat: booth.lat, lng: booth.lng },
    deleted: false,
    sortOrder: index,
  }));

  shapes.forEach((shape, index) => {
    changes.push({
      nodeId: shape.nodeId,
      clientNodeId: shape.nodeId ? null : shape.id,
      nodeType: shape.nodeType,
      name: shape.name,
      geometryType: shape.kind === "polygon" ? "POLYGON" : "POLYLINE",
      geometry: { points: shape.points },
      deleted: false,
      sortOrder: booths.length + index,
    });
  });

  for (const nodeId of deletedNodeIds) {
    changes.push({
      nodeId,
      nodeType: "BOOTH",
      name: "",
      geometryType: "POINT",
      geometry: { lat: 0, lng: 0 },
      deleted: true,
      sortOrder: 0,
    });
  }

  return changes;
}

/** 구역에는 현재 존재하는 부스만 포함하며 신규 부스는 clientNodeId로 연결한다. */
export function boothIdsToNodeIds(boothIds: string[], booths: LocalBoothPin[]): string[] {
  const nodeIdByBoothId = new Map(booths.map((booth) => [booth.id, booth.nodeId ?? booth.id]));
  return boothIds.flatMap((id) => {
    const nodeId = nodeIdByBoothId.get(id);
    return nodeId === undefined ? [] : [nodeId];
  });
}
