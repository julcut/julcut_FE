import assert from "node:assert/strict";
import { it } from "node:test";
import { presentationBoundary, presentationOverlay } from "./mapPresentation";
import type { MapPresentation } from "./types";

it("서버 팜플렛의 자산 ID와 만료 시각을 저장용 로컬 상태에 유지한다", () => {
  const presentation: MapPresentation = {
    boundary: null,
    overlay: {
      assetId: "image-asset",
      imageUrl: "https://example.test/image",
      imageUrlExpiresAt: "2026-09-08T12:00:00Z",
      imageWidth: 200,
      imageHeight: 100,
      anchor: {
        centerLatitude: 37.5,
        centerLongitude: 127,
        groundWidthMeters: 100,
        rotationDegrees: 90,
      },
      opacity: 0.7,
      visible: true,
      clipToBoundary: false,
    },
  };
  const local = presentationOverlay(presentation);
  assert.equal(local?.assetId, "image-asset");
  assert.equal(local?.imageUrlExpiresAt, presentation.overlay?.imageUrlExpiresAt);
  assert.equal(local?.anchor.rotationDegrees, 90);
  assert.ok(local?.corners);
});

it("설정이 없는 지도는 경계와 이미지를 만들지 않는다", () => {
  assert.equal(presentationBoundary(undefined), null);
  assert.equal(presentationOverlay(undefined), null);
});
