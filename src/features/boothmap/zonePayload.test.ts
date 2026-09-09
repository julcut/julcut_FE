import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LocalBoothPin, LocalMapShape } from "./geometryWgs84";
import { buildZoneChanges } from "./zonePayload";

function pin(id: string, overrides: Partial<LocalBoothPin> = {}): LocalBoothPin {
  return {
    id,
    nodeId: null,
    name: id,
    nodeType: "BOOTH",
    lat: 37.5,
    lng: 127,
    ...overrides,
  };
}

function polygon(id: string, name: string): LocalMapShape {
  return {
    id,
    nodeId: null,
    name,
    nodeType: "OPEN_SPACE",
    kind: "polygon",
    points: [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
    ],
  };
}

describe("buildZoneChanges", () => {
  it("폴리곤 안에 든 부스를 구역으로 담는다", () => {
    const booths = [pin("a"), pin("b")];
    const changes = buildZoneChanges({
      zones: [],
      booths,
      polygonShapes: [polygon("shape-1", "로스터리 마켓존")],
      shapeIdByBoothId: new Map([
        ["a", "shape-1"],
        ["b", "shape-1"],
      ]),
    });
    assert.deepEqual(changes, [
      { zoneId: "shape-1", name: "로스터리 마켓존", sortOrder: 0, boothNodeIds: ["a", "b"] },
    ]);
  });

  it("저장된 폴리곤은 노드 id를 구역 id로 쓴다", () => {
    const changes = buildZoneChanges({
      zones: [],
      booths: [pin("a", { nodeId: "node-a" })],
      polygonShapes: [{ ...polygon("shape-1", "구역"), nodeId: "node-shape" }],
      shapeIdByBoothId: new Map([["a", "shape-1"]]),
    });
    assert.equal(changes[0].zoneId, "node-shape");
    assert.deepEqual(changes[0].boothNodeIds, ["node-a"]);
  });

  it("부스가 아닌 핀은 구역에 넣지 않는다", () => {
    const changes = buildZoneChanges({
      zones: [],
      booths: [pin("a", { nodeType: "RESTROOM" }), pin("b")],
      polygonShapes: [polygon("shape-1", "구역")],
      shapeIdByBoothId: new Map([
        ["a", "shape-1"],
        ["b", "shape-1"],
      ]),
    });
    assert.deepEqual(changes[0].boothNodeIds, ["b"]);
  });

  it("한 부스를 두 구역이 가져가지 않는다", () => {
    const changes = buildZoneChanges({
      zones: [{ id: "zone-1", name: "고른 구역", boothIds: ["a"] }],
      booths: [pin("a"), pin("b")],
      polygonShapes: [polygon("shape-1", "폴리곤 구역")],
      shapeIdByBoothId: new Map([
        ["a", "shape-1"],
        ["b", "shape-1"],
      ]),
    });
    assert.deepEqual(
      changes.map((zone) => [zone.zoneId, zone.boothNodeIds]),
      [
        ["zone-1", ["a"]],
        ["shape-1", ["b"]],
      ],
    );
  });

  it("빈 구역과 이름 없는 구역은 담지 않는다", () => {
    const changes = buildZoneChanges({
      zones: [{ id: "zone-1", name: "빈 구역", boothIds: [] }],
      booths: [pin("a")],
      polygonShapes: [polygon("shape-1", "   ")],
      shapeIdByBoothId: new Map([["a", "shape-1"]]),
    });
    assert.deepEqual(changes, []);
  });
});
