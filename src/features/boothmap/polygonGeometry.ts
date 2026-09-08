import { readLatLng, sameLatLng, type LatLng } from "./latLng";

export const MAX_BOUNDARY_VERTICES = 500;

/** 전송용: 마지막 점이 첫 점과 같으면 중복을 제거한다. 렌더러에서 닫는다. */
export function withoutClosingDuplicate(points: LatLng[]): LatLng[] {
  if (points.length < 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (sameLatLng(first, last)) return points.slice(0, -1);
  return [...points];
}

export function uniqueVertices(points: LatLng[]): LatLng[] {
  const unique: LatLng[] = [];
  points.forEach((point) => {
    if (!unique.some((existing) => sameLatLng(existing, point))) unique.push(point);
  });
  return unique;
}

/** 신발끈 공식. 위경도를 평면으로 근사한다. */
export function polygonArea(points: LatLng[]): number {
  const ring = withoutClosingDuplicate(points);
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    sum +=
      (current.lng - ring[0].lng) * (next.lat - ring[0].lat) -
      (next.lng - ring[0].lng) * (current.lat - ring[0].lat);
  }
  return Math.abs(sum) / 2;
}

function segmentsIntersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean {
  const direction = (p: LatLng, q: LatLng, r: LatLng) =>
    (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
  const onSegment = (p: LatLng, q: LatLng, r: LatLng) =>
    Math.min(p.lng, r.lng) - 1e-15 <= q.lng &&
    q.lng <= Math.max(p.lng, r.lng) + 1e-15 &&
    Math.min(p.lat, r.lat) - 1e-15 <= q.lat &&
    q.lat <= Math.max(p.lat, r.lat) + 1e-15;
  const d1 = direction(b1, b2, a1);
  const d2 = direction(b1, b2, a2);
  const d3 = direction(a1, a2, b1);
  const d4 = direction(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (Math.abs(d1) <= 1e-15 && onSegment(b1, a1, b2)) return true;
  if (Math.abs(d2) <= 1e-15 && onSegment(b1, a2, b2)) return true;
  if (Math.abs(d3) <= 1e-15 && onSegment(a1, b1, a2)) return true;
  if (Math.abs(d4) <= 1e-15 && onSegment(a1, b2, a2)) return true;
  return false;
}

export function hasSelfIntersection(points: LatLng[]): boolean {
  const ring = withoutClosingDuplicate(points);
  if (ring.length < 4) return false;
  const edgeCount = ring.length;
  for (let i = 0; i < edgeCount; i += 1) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % edgeCount];
    for (let j = i + 1; j < edgeCount; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === edgeCount - 1);
      if (adjacent) continue;
      const b1 = ring[j];
      const b2 = ring[(j + 1) % edgeCount];
      const shareVertex =
        sameLatLng(a1, b1) || sameLatLng(a1, b2) || sameLatLng(a2, b1) || sameLatLng(a2, b2);
      if (shareVertex) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function validateBoundary(points: LatLng[]): string | null {
  const ring = withoutClosingDuplicate(points);
  if (ring.some((point) => !readLatLng(point))) return "유효한 위경도 좌표가 필요합니다.";
  if (uniqueVertices(ring).length !== ring.length) return "중복된 꼭짓점은 사용할 수 없습니다.";
  if (ring.length < 3) return "경계는 서로 다른 꼭짓점이 3개 이상이어야 합니다.";
  if (ring.length > MAX_BOUNDARY_VERTICES) {
    return `경계 꼭짓점은 ${MAX_BOUNDARY_VERTICES}개를 넘을 수 없습니다.`;
  }
  if (polygonArea(ring) === 0) return "면적이 0인 경계는 저장할 수 없습니다.";
  if (hasSelfIntersection(ring)) return "선이 교차하는 경계는 저장할 수 없습니다.";
  return null;
}

export function isNearPoint(target: LatLng, candidate: LatLng, degrees = 0.00008): boolean {
  return (
    Math.abs(target.lat - candidate.lat) <= degrees &&
    Math.abs(target.lng - candidate.lng) <= degrees
  );
}
