import { expect, test } from "@playwright/test";
import { boothIdsToNodeIds, type LocalBoothPin } from "../src/features/boothmap/geometryWgs84";

test("구역 저장은 삭제한 부스를 제외하고 기존 UUID와 신규 clientNodeId를 보존한다", () => {
  const savedId = "00000000-0000-0000-0000-000000000001";
  const newId = "00000000-0000-0000-0000-000000000002";
  const deletedId = "00000000-0000-0000-0000-000000000003";
  const booths: LocalBoothPin[] = [
    {
      id: `node-${savedId}`,
      nodeId: savedId,
      name: "기존 부스",
      nodeType: "BOOTH",
      lat: 37.5,
      lng: 127,
    },
    { id: newId, nodeId: null, name: "신규 부스", nodeType: "BOOTH", lat: 37.6, lng: 127 },
  ];
  expect(boothIdsToNodeIds([`node-${savedId}`, `node-${deletedId}`, newId], booths)).toEqual([
    savedId,
    newId,
  ]);
  expect(boothIdsToNodeIds([`node-${deletedId}`], booths)).toEqual([]);
});
