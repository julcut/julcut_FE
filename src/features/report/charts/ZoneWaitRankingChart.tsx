import type { FestivalReportPerformance } from "../types";

type ZoneWaitRanking = FestivalReportPerformance["metrics"]["zoneWaitRanking"];

/** 설계서 3-5: 대기시간 기준 상위 5개 구역만 노출한다. */
export const ZONE_RANKING_LIMIT = 5;

/**
 * 3-5. 구역별 혼잡도 랭킹.
 * x축 = 평균 대기시간, y축 = 구역명인 가로 막대그래프.
 */
export function ZoneWaitRankingChart({ ranking }: { ranking: ZoneWaitRanking }) {
  const rows = [...ranking]
    .sort((a, b) => b.averageWaitMinutes - a.averageWaitMinutes)
    .slice(0, ZONE_RANKING_LIMIT);
  if (!rows.length) return <p className="body-small text-zinc-400">구역별 데이터가 없습니다.</p>;

  const maximum = Math.max(1, ...rows.map((zone) => zone.averageWaitMinutes));

  return (
    <ol className="flex flex-col gap-4">
      {rows.map((zone, index) => (
        <li key={`${zone.zoneName}-${index}`}>
          <div className="mb-1 flex items-center justify-between gap-2 body-small">
            <span className="truncate text-zinc-950">
              {index + 1}. {zone.zoneName}
            </span>
            <span className="shrink-0 body-small-bold text-zinc-950">
              {zone.averageWaitMinutes.toLocaleString()}분
            </span>
          </div>
          <div className="h-3 rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, (zone.averageWaitMinutes / maximum) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
