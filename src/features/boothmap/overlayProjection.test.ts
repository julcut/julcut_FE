import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cornersFromAnchor } from "./overlayProjection";

describe("cornersFromAnchor", () => {
  const anchor = {
    centerLatitude: 37.5,
    centerLongitude: 127.0,
    groundWidthMeters: 100,
    rotationDegrees: 0,
  };

  it("0도에서 위쪽이 북쪽이 되고 중심이 유지된다", () => {
    const corners = cornersFromAnchor(anchor, 200, 100);
    assert.ok(corners);
    const centerLat = (corners.topLeft.lat + corners.bottomRight.lat) / 2;
    const centerLng = (corners.topLeft.lng + corners.bottomRight.lng) / 2;
    assert.ok(Math.abs(centerLat - 37.5) < 1e-8);
    assert.ok(Math.abs(centerLng - 127.0) < 1e-8);
    assert.ok(corners.topLeft.lat > corners.bottomLeft.lat);
    assert.ok(corners.topRight.lng > corners.topLeft.lng);
  });

  it("90도 회전 후에도 네 귀퉁이가 서로 다른 위치를 유지한다", () => {
    const corners = cornersFromAnchor({ ...anchor, rotationDegrees: 90 }, 200, 100);
    assert.ok(corners);
    const lats = [
      corners.topLeft.lat,
      corners.topRight.lat,
      corners.bottomRight.lat,
      corners.bottomLeft.lat,
    ];
    const lngs = [
      corners.topLeft.lng,
      corners.topRight.lng,
      corners.bottomRight.lng,
      corners.bottomLeft.lng,
    ];
    assert.equal(new Set(lats.map((value) => value.toFixed(7))).size > 1, true);
    assert.equal(new Set(lngs.map((value) => value.toFixed(7))).size > 1, true);
  });

  it("180·270도에서도 중심이 크게 벗어나지 않는다", () => {
    for (const rotationDegrees of [180, 270]) {
      const corners = cornersFromAnchor({ ...anchor, rotationDegrees }, 200, 100);
      assert.ok(corners);
      const centerLat = (corners.topLeft.lat + corners.bottomRight.lat) / 2;
      assert.ok(Math.abs(centerLat - 37.5) < 1e-6, `rotation ${rotationDegrees}`);
    }
  });
});
