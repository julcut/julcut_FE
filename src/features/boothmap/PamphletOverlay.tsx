"use client";

import { useEffect, useId, useRef } from "react";
import type { LatLng } from "./latLng";
import type { OverlayCorners } from "./overlayProjection";

export interface PamphletOverlayProps {
  map: kakao.maps.Map | null;
  imageUrl: string | null;
  corners: OverlayCorners | null;
  boundary: LatLng[] | null;
  clipToBoundary: boolean;
  opacity: number;
  visible: boolean;
  /** 보기 모드에서는 포인터를 가로채지 않는다. */
  interactive?: boolean;
  onImageError?: () => void;
}

function affineMatrix(
  width: number,
  height: number,
  topLeft: { x: number; y: number },
  topRight: { x: number; y: number },
  bottomLeft: { x: number; y: number },
): string {
  const a = (topRight.x - topLeft.x) / width;
  const b = (topRight.y - topLeft.y) / width;
  const c = (bottomLeft.x - topLeft.x) / height;
  const d = (bottomLeft.y - topLeft.y) / height;
  return `matrix(${a} ${b} ${c} ${d} ${topLeft.x} ${topLeft.y})`;
}

/**
 * 카카오 `AbstractOverlay`로 팜플렛 이미지를 네 귀퉁이에 맞춘다.
 * SW/NE GroundOverlay bounds를 쓰지 않아 회전이 유지된다.
 */
export function PamphletOverlay({
  map,
  imageUrl,
  corners,
  boundary,
  clipToBoundary,
  opacity,
  visible,
  interactive = false,
  onImageError,
}: PamphletOverlayProps) {
  const clipId = useId().replace(/:/g, "");
  const overlayRef = useRef<kakao.maps.AbstractOverlay | null>(null);
  const onImageErrorRef = useRef(onImageError);
  useEffect(() => {
    onImageErrorRef.current = onImageError;
  }, [onImageError]);

  useEffect(() => {
    if (!map || !window.kakao?.maps || !imageUrl || !corners || !visible) return;
    const overlayCorners = corners;
    const overlayUrl = imageUrl;
    let disposed = false;

    const root = document.createElement("div");
    root.style.position = "absolute";
    root.style.left = "0";
    root.style.top = "0";
    root.style.pointerEvents = interactive ? "auto" : "none";
    root.style.opacity = String(Math.min(1, Math.max(0, opacity)));

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("overflow", "visible");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    clipPath.appendChild(clipPolygon);
    defs.appendChild(clipPath);

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("width", "1");
    image.setAttribute("height", "1");
    image.setAttribute("href", overlayUrl);
    const handleError = () => {
      if (!disposed) onImageErrorRef.current?.();
    };
    image.addEventListener("error", handleError);
    group.appendChild(image);
    const secondImage = image.cloneNode(true) as SVGImageElement;
    group.appendChild(secondImage);
    const triangleClips = ["first", "second"].map((suffix) => {
      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.id = `${clipId}-${suffix}`;
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      clip.appendChild(polygon);
      defs.appendChild(clip);
      return { clip, polygon };
    });
    // 클립은 이미지 변환의 바깥 그룹에 적용해 지도 투영 좌표를 그대로 쓴다.
    [image, secondImage].forEach((element, index) => {
      const triangle = document.createElementNS("http://www.w3.org/2000/svg", "g");
      triangle.setAttribute("clip-path", `url(#${triangleClips[index].clip.id})`);
      triangle.appendChild(element);
      group.appendChild(triangle);
    });
    svg.appendChild(defs);
    svg.appendChild(group);
    root.appendChild(svg);

    class PamphletImageOverlay extends window.kakao.maps.AbstractOverlay {
      onAdd() {
        this.getPanels().overlayLayer.prepend(root);
      }

      onRemove() {
        root.remove();
      }

      draw() {
        if (disposed) return;
        const projection = this.getProjection();
        const toPoint = (point: LatLng) =>
          projection.pointFromCoords(new window.kakao.maps.LatLng(point.lat, point.lng));
        const topLeft = toPoint(overlayCorners.topLeft);
        const topRight = toPoint(overlayCorners.topRight);
        const bottomLeft = toPoint(overlayCorners.bottomLeft);
        const bottomRight = toPoint(overlayCorners.bottomRight);
        image.setAttribute("transform", affineMatrix(1, 1, topLeft, topRight, bottomLeft));
        secondImage.setAttribute(
          "transform",
          affineMatrix(
            1,
            1,
            {
              x: topRight.x + bottomLeft.x - bottomRight.x,
              y: topRight.y + bottomLeft.y - bottomRight.y,
            },
            topRight,
            bottomLeft,
          ),
        );
        [
          [topLeft, topRight, bottomLeft],
          [topRight, bottomRight, bottomLeft],
        ].forEach((points, index) => {
          triangleClips[index].polygon.setAttribute(
            "points",
            points.map((point) => `${point.x},${point.y}`).join(" "),
          );
        });
        if (clipToBoundary && boundary && boundary.length >= 3) {
          const clipPoints = boundary.map((point) => {
            const projected = toPoint(point);
            return `${projected.x},${projected.y}`;
          });
          clipPolygon.setAttribute("points", clipPoints.join(" "));
          group.setAttribute("clip-path", `url(#${clipId})`);
        } else {
          group.removeAttribute("clip-path");
        }
      }
    }

    const overlay = new PamphletImageOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed) {
        map.relayout();
        overlay.draw();
      }
    });
    resizeObserver.observe(map.getNode());
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      image.removeEventListener("error", handleError);
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, imageUrl, corners, boundary, clipToBoundary, opacity, visible, interactive, clipId]);

  return null;
}
