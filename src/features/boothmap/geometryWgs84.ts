import type { NodeChangeRequest, NodeResponse, NodeType } from "./types";
import { isFiniteNumber, readLatLng, readLatLngList, type LatLng } from "./latLng";

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
  relatedBoothId?: number | null;
}

/** 카카오맵 위에 직접 그리는 자유 도형(폴리곤·라인). 서버의 POLYGON/POLYLINE 노드에 대응한다. */
export interface LocalMapShape {
  id: string;
  nodeId: string | null;
  name: string;
  nodeType: NodeType;
  kind: "polygon" | "line";
  points: LatLng[];
  isNew?: boolean;
}

/** 폴리곤은 3점, 라인은 2점 이상이어야 서버가 받는다(MapGeometryValidator). */
export const SHAPE_MINIMUM_POINTS: Record<LocalMapShape["kind"], number> = {
  polygon: 3,
  line: 2,
};

/** 화면에 올리지 않고 변경 요청에서도 제외해 서버 원본을 보존하는 노드. */
export interface PreservedNode {
  node: NodeResponse;
  reason: string;
}

export interface PartitionedEditorNodes {
  pins: LocalBoothPin[];
  shapes: LocalMapShape[];
  preserved: PreservedNode[];
}

function isSchema10(node: NodeResponse): boolean {
  return node.geometrySchemaVersion === "1.0";
}

function nodeLocalId(nodeId: string): string {
  return `node-${nodeId}`;
}

export function nodeToLocalBooth(node: NodeResponse): LocalBoothPin | null {
  if (node.geometrySchemaVersion !== "2.0") return null;
  if (node.geometryType !== "POINT") return null;
  const point = readLatLng(node.geometry);
  if (!point) return null;
  return {
    id: nodeLocalId(node.nodeId),
    nodeId: node.nodeId,
    name: node.name,
    nodeType: node.nodeType,
    lat: point.lat,
    lng: point.lng,
    uncertain: node.reviewStatus === "REVIEW_REQUIRED",
    isNew: false,
    relatedBoothId: node.relatedBoothId ?? null,
  };
}

/** schema 2.0 POLYGON/POLYLINE 노드를 지도 위 도형으로 변환한다. 그 밖의 노드는 null. */
export function nodeToLocalShape(node: NodeResponse): LocalMapShape | null {
  if (node.geometrySchemaVersion !== "2.0") return null;
  if (node.geometryType !== "POLYGON" && node.geometryType !== "POLYLINE") return null;
  const points = readLatLngList(node.geometry.points);
  if (!points) return null;
  const kind = node.geometryType === "POLYGON" ? "polygon" : "line";
  if (points.length < SHAPE_MINIMUM_POINTS[kind]) return null;
  return {
    id: nodeLocalId(node.nodeId),
    nodeId: node.nodeId,
    name: node.name,
    nodeType: node.nodeType,
    kind,
    points,
    isNew: false,
  };
}

export function partitionEditorNodes(nodes: NodeResponse[]): PartitionedEditorNodes {
  const pins: LocalBoothPin[] = [];
  const shapes: LocalMapShape[] = [];
  const preserved: PreservedNode[] = [];

  nodes.forEach((node) => {
    const pin = nodeToLocalBooth(node);
    if (pin) {
      pins.push(pin);
      return;
    }
    const shape = nodeToLocalShape(node);
    if (shape) {
      shapes.push(shape);
      return;
    }
    const reason = isSchema10(node)
      ? "이미지 정규화(schema 1.0) 노드는 카카오 좌표 지도에서 변환하지 않습니다."
      : `지원하지 않는 도형(${node.geometryType}, schema ${node.geometrySchemaVersion ?? "없음"})을 보존합니다.`;
    preserved.push({ node, reason });
  });

  return { pins, shapes, preserved };
}

function pinToChange(booth: LocalBoothPin, sortOrder: number): NodeChangeRequest {
  return {
    nodeId: booth.nodeId,
    clientNodeId: booth.nodeId ? null : booth.id,
    nodeType: booth.nodeType,
    name: booth.name,
    geometryType: "POINT",
    geometry: { lat: booth.lat, lng: booth.lng },
    deleted: false,
    sortOrder,
  };
}

function shapeToChange(shape: LocalMapShape, sortOrder: number): NodeChangeRequest {
  return {
    nodeId: shape.nodeId,
    clientNodeId: shape.nodeId ? null : shape.id,
    nodeType: shape.nodeType,
    name: shape.name,
    geometryType: shape.kind === "polygon" ? "POLYGON" : "POLYLINE",
    geometry: { points: shape.points },
    deleted: false,
    sortOrder,
  };
}

export function boothMapPinsToNodeChanges(
  booths: LocalBoothPin[],
  deletedNodeIds: string[],
  shapes: LocalMapShape[] = [],
  preserved: PreservedNode[] = [],
): NodeChangeRequest[] {
  const changes: NodeChangeRequest[] = [];
  const preservedIds = new Set(preserved.map(({ node }) => node.nodeId));
  let sortOrder = 0;
  booths.forEach((booth) => {
    if (booth.nodeId && preservedIds.has(booth.nodeId)) return;
    changes.push(pinToChange(booth, sortOrder));
    sortOrder += 1;
  });
  shapes.forEach((shape) => {
    if (shape.nodeId && (preservedIds.has(shape.nodeId) || deletedNodeIds.includes(shape.nodeId)))
      return;
    changes.push(shapeToChange(shape, sortOrder));
    sortOrder += 1;
  });
  // BE는 명시된 변경만 적용한다. 미지원 좌표를 재전송하면 현재 지도 schema 검증에 실패한다.
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

export function isUsablePinCoordinate(lat: unknown, lng: unknown): boolean {
  return isFiniteNumber(lat) && isFiniteNumber(lng) && readLatLng({ lat, lng }) !== null;
}
