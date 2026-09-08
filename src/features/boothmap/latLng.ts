export interface LatLng {
  lat: number;
  lng: number;
}

const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LNG = -180;
const MAX_LNG = 180;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidWgs84(point: LatLng): boolean {
  return (
    isFiniteNumber(point.lat) &&
    isFiniteNumber(point.lng) &&
    point.lat >= MIN_LAT &&
    point.lat <= MAX_LAT &&
    point.lng >= MIN_LNG &&
    point.lng <= MAX_LNG
  );
}

export function readLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record.lat) || !isFiniteNumber(record.lng)) return null;
  const point = { lat: record.lat, lng: record.lng };
  return isValidWgs84(point) ? point : null;
}

export function readLatLngList(value: unknown): LatLng[] | null {
  if (!Array.isArray(value)) return null;
  const points: LatLng[] = [];
  for (const item of value) {
    const point = readLatLng(item);
    if (!point) return null;
    points.push(point);
  }
  return points;
}

export function sameLatLng(a: LatLng, b: LatLng, epsilon = 1e-12): boolean {
  return Math.abs(a.lat - b.lat) <= epsilon && Math.abs(a.lng - b.lng) <= epsilon;
}
