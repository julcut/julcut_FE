import type { LatLng } from "./latLng";

/** 백엔드 `MapAnchorProjector`와 같은 위도 1도 거리(m). */
export const METERS_PER_DEGREE_LATITUDE = 111_320;

export interface OverlayAnchor {
  centerLatitude: number;
  centerLongitude: number;
  groundWidthMeters: number;
  rotationDegrees: number;
}

export interface OverlayCorners {
  topLeft: LatLng;
  topRight: LatLng;
  bottomRight: LatLng;
  bottomLeft: LatLng;
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

function projectNormalized(
  anchor: OverlayAnchor,
  imageWidth: number,
  imageHeight: number,
  x: number,
  y: number,
): LatLng {
  const groundHeightMeters = anchor.groundWidthMeters * (imageHeight / imageWidth);
  const theta = (anchor.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LATITUDE * Math.cos((anchor.centerLatitude * Math.PI) / 180);
  const dx = (x - 0.5) * anchor.groundWidthMeters;
  const dy = -(y - 0.5) * groundHeightMeters;
  const east = dx * cos + dy * sin;
  const north = -dx * sin + dy * cos;
  const latitude = anchor.centerLatitude + north / METERS_PER_DEGREE_LATITUDE;
  const longitude =
    Math.abs(metersPerDegreeLongitude) < 1e-9
      ? anchor.centerLongitude
      : anchor.centerLongitude + east / metersPerDegreeLongitude;
  return { lat: clamp(latitude, 90), lng: clamp(longitude, 180) };
}

/** 이미지 네 귀퉁이를 앵커·종횡비로 WGS84에 올린다. 회전된 사각형을 SW/NE bounds로 바꾸지 않는다. */
export function cornersFromAnchor(
  anchor: OverlayAnchor,
  imageWidth: number,
  imageHeight: number,
): OverlayCorners | null {
  if (
    !anchor ||
    !Number.isFinite(anchor.centerLatitude) ||
    !Number.isFinite(anchor.centerLongitude) ||
    !Number.isFinite(anchor.groundWidthMeters) ||
    !Number.isFinite(anchor.rotationDegrees) ||
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    Math.abs(anchor.centerLatitude) >= 90 ||
    Math.abs(anchor.centerLongitude) > 180 ||
    Math.abs(anchor.rotationDegrees) > 360 ||
    anchor.groundWidthMeters > 100000 ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    anchor.groundWidthMeters <= 0
  ) {
    return null;
  }
  return {
    topLeft: projectNormalized(anchor, imageWidth, imageHeight, 0, 0),
    topRight: projectNormalized(anchor, imageWidth, imageHeight, 1, 0),
    bottomRight: projectNormalized(anchor, imageWidth, imageHeight, 1, 1),
    bottomLeft: projectNormalized(anchor, imageWidth, imageHeight, 0, 1),
  };
}
