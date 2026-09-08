import { readLatLngList, type LatLng } from "./latLng";
import { cornersFromAnchor, type OverlayAnchor, type OverlayCorners } from "./overlayProjection";
import type { MapPresentation } from "./types";

export interface LocalPamphletOverlay {
  assetId?: string | null;
  imageUrlExpiresAt?: string | null;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  anchor: OverlayAnchor;
  corners: OverlayCorners;
  opacity: number;
  visible: boolean;
  clipToBoundary: boolean;
  localObjectUrl?: string;
}

export function presentationBoundary(
  presentation: MapPresentation | null | undefined,
): LatLng[] | null {
  const points = readLatLngList(presentation?.boundary?.points);
  if (
    presentation?.boundary?.schemaVersion !== "2.0" ||
    presentation.boundary.geometryType !== "POLYGON" ||
    !points ||
    points.length < 3
  )
    return null;
  return points;
}

export function presentationOverlay(
  presentation: MapPresentation | null | undefined,
): LocalPamphletOverlay | null {
  const overlay = presentation?.overlay;
  if (
    !overlay?.imageUrl ||
    !cornersFromAnchor(overlay.anchor, overlay.imageWidth, overlay.imageHeight)
  )
    return null;
  const corners =
    overlay.corners ?? cornersFromAnchor(overlay.anchor, overlay.imageWidth, overlay.imageHeight);
  if (!corners) return null;
  return {
    assetId: overlay.assetId,
    imageUrlExpiresAt: overlay.imageUrlExpiresAt,
    imageUrl: overlay.imageUrl,
    imageWidth: overlay.imageWidth,
    imageHeight: overlay.imageHeight,
    anchor: overlay.anchor,
    corners,
    opacity: overlay.opacity,
    visible: overlay.visible,
    clipToBoundary: overlay.clipToBoundary,
  };
}
