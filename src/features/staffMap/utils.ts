import type { Booth, CongestionLevel } from "@/features/dashboard/types";
import { parseServerDateTime } from "@/lib/serverDateTime";

const EARTH_RADIUS_METERS = 6_371_000;

/** 두 좌표 사이의 대원거리(m). 줄끝까지의 거리를 서버에 보낼 때 쓴다. */
export function distanceInMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)));
}

/** 좌표 목록의 중심점. 구역을 대표하는 좌표로 쓴다. */
export function centerOf(
  points: { lat: number; lng: number }[],
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

const CONGESTION_SCORE: Record<CongestionLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const SCORE_CONGESTION: CongestionLevel[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * 축제 전체 혼잡도. 서버가 전체 등급을 따로 내려주지 않아,
 * 혼잡도가 입력된 부스들의 평균 등급을 반올림해서 쓴다.
 */
export function overallCongestion(booths: Booth[]): CongestionLevel | null {
  const levels = booths
    .map((booth) => booth.congestionLevel)
    .filter((level): level is CongestionLevel => Boolean(level));
  if (levels.length === 0) return null;
  const average = levels.reduce((sum, level) => sum + CONGESTION_SCORE[level], 0) / levels.length;
  return SCORE_CONGESTION[Math.round(average)];
}

/** 혼잡도가 가장 높고, 같으면 대기시간이 긴 부스. */
export function busiestBooth(booths: Booth[]): Booth | null {
  const scored = booths.filter((booth) => booth.congestionLevel);
  if (scored.length === 0) return null;
  return scored.reduce((busiest, booth) => {
    const boothScore = CONGESTION_SCORE[booth.congestionLevel!];
    const busiestScore = CONGESTION_SCORE[busiest.congestionLevel!];
    if (boothScore !== busiestScore) return boothScore > busiestScore ? booth : busiest;
    return (booth.waitMinutes ?? 0) > (busiest.waitMinutes ?? 0) ? booth : busiest;
  });
}

/**
 * "방금 전" / "5분 전" / "2시간 전" 형태의 상대 시각.
 *
 * 서버가 타임존 표기 없이 UTC로 내려주므로 `parseServerDateTime`으로 읽는다.
 * 그냥 `new Date`로 읽으면 방금 갱신한 값이 "9시간 전"으로 보인다.
 */
export function formatRelativeTime(isoDateTime: string | null | undefined): string {
  if (!isoDateTime) return "기록 없음";
  const target = parseServerDateTime(isoDateTime);
  if (Number.isNaN(target)) return "기록 없음";
  const diffMinutes = Math.floor((Date.now() - target) / 60_000);
  // 서버 시계가 조금 앞서 있어도 "-1분 전"처럼 보이지 않게 한다.
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}
