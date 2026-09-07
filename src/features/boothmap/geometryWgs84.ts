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

export function boothMapPinsToNodeChanges(
  booths: LocalBoothPin[],
  deletedNodeIds: string[],
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
