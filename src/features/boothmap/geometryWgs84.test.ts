import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boothMapPinsToNodeChanges,
  partitionEditorNodes,
  type LocalBoothPin,
} from "./geometryWgs84";
import type { NodeResponse } from "./types";

function pointNode(overrides: Partial<NodeResponse> = {}): NodeResponse {
  return {
    nodeId: "11111111-1111-1111-1111-111111111111",
    nodeType: "BOOTH",
    name: "부스 A",
    geometryType: "POINT",
    geometry: { lat: 37.5, lng: 127.0 },
    confidence: null,
    recognizedText: null,
    source: "ADMIN",
    reviewStatus: "CONFIRMED",
    sortOrder: 0,
    geometrySchemaVersion: "2.0",
    relatedBoothId: 9,
    ...overrides,
  };
}

describe("partitionEditorNodes", () => {
  it("미확인 schema를 WGS84로 추측하지 않는다", () => {
    for (const geometrySchemaVersion of [undefined, "3.0"]) {
      const result = partitionEditorNodes([pointNode({ geometrySchemaVersion })]);
      assert.equal(result.pins.length, 0);
      assert.equal(result.preserved.length, 1);
    }
  });
  it("폴리곤을 읽고 저장해도 POLYGON과 좌표가 유지된다", () => {
    const node = pointNode({
      geometryType: "POLYGON",
      geometry: {
        points: [
          { lat: 37.5, lng: 127 },
          { lat: 37.51, lng: 127 },
          { lat: 37.51, lng: 127.01 },
        ],
      },
    });
    const result = partitionEditorNodes([node]);
    const [change] = boothMapPinsToNodeChanges([], [], result.shapes);
    assert.equal(change.geometryType, "POLYGON");
    assert.deepEqual(change.geometry, node.geometry);
  });
  it("POINT schema 2.0을 핀으로 옮기고 relatedBoothId를 유지한다", () => {
    const { pins, preserved } = partitionEditorNodes([pointNode()]);
    assert.equal(pins.length, 1);
    assert.equal(pins[0]?.lat, 37.5);
    assert.equal(pins[0]?.relatedBoothId, 9);
    assert.equal(preserved.length, 0);
  });

  it("schema 1.0과 알 수 없는 도형은 보존하고 POINT로 바꾸지 않는다", () => {
    const { pins, preserved } = partitionEditorNodes([
      pointNode({ geometrySchemaVersion: "1.0", geometry: { x: 0.1, y: 0.2 } }),
      pointNode({
        nodeId: "22222222-2222-2222-2222-222222222222",
        geometryType: "RECTANGLE",
        geometry: { x: 0, y: 0, width: 1, height: 1 },
      }),
    ]);
    assert.equal(pins.length, 0);
    assert.equal(preserved.length, 2);
  });

  it("POLYLINE은 편집 도형으로 분류한다", () => {
    const { shapes } = partitionEditorNodes([
      pointNode({
        nodeType: "QUEUE",
        geometryType: "POLYLINE",
        geometry: {
          points: [
            { lat: 37.5, lng: 127.0 },
            { lat: 37.51, lng: 127.01 },
          ],
        },
      }),
    ]);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0]?.kind, "line");
    assert.equal(shapes[0]?.points.length, 2);
  });
});

describe("boothMapPinsToNodeChanges", () => {
  it("미지원 노드는 변경에서 제외하고 삭제 요청은 명시된 ID만 만든다", () => {
    const pin: LocalBoothPin = {
      id: "local-1",
      nodeId: "11111111-1111-1111-1111-111111111111",
      name: "부스 A",
      nodeType: "BOOTH",
      lat: 37.5,
      lng: 127.0,
    };
    const preservedNode = pointNode({
      nodeId: "33333333-3333-3333-3333-333333333333",
      geometryType: "RECTANGLE",
      geometry: { x: 0, y: 0, width: 1, height: 1 },
    });
    const changes = boothMapPinsToNodeChanges(
      [pin],
      ["44444444-4444-4444-4444-444444444444"],
      [],
      [{ node: preservedNode, reason: "미지원" }],
    );
    assert.equal(changes.length, 2);
    assert.equal(changes[0]?.geometryType, "POINT");
    assert.equal(changes[0]?.deleted, false);
    assert.equal(
      changes.some((change) => change.nodeId === preservedNode.nodeId),
      false,
    );
    assert.equal(changes[1]?.deleted, true);
    assert.equal(changes[1]?.nodeId, "44444444-4444-4444-4444-444444444444");
  });

  it("위경도 왕복을 유지한다", () => {
    const pin: LocalBoothPin = {
      id: "local-1",
      nodeId: null,
      name: "새 부스",
      nodeType: "BOOTH",
      lat: 35.1796,
      lng: 129.0756,
    };
    const [change] = boothMapPinsToNodeChanges([pin], []);
    assert.deepEqual(change?.geometry, { lat: 35.1796, lng: 129.0756 });
  });
});
