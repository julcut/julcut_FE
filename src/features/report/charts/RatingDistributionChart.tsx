import { StarFilledIcon } from "@radix-ui/react-icons";
import type { FestivalReportEvaluation } from "../types";

type RatingDistribution = FestivalReportEvaluation["reviews"]["ratingDistribution"];

/**
 * 평점 분포 히스토그램. 1~5점 응답 비율을 가로 바차트로 그린다.
 * 백엔드 `ratio`는 0~1 소수로 내려오지만, 방어적으로 1을 넘는 값(퍼센트)도 허용한다.
 */
export function RatingDistributionChart({ distribution }: { distribution: RatingDistribution }) {
  if (!distribution.length)
    return <p className="body-small text-zinc-400">평점 분포 데이터가 없습니다.</p>;

  const rows = [...distribution].sort((a, b) => b.rating - a.rating);
  const toPercent = (ratio: number) => (ratio <= 1 ? ratio * 100 : ratio);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((item) => {
        const percent = Math.min(100, Math.max(0, toPercent(item.ratio)));
        return (
          <li
            key={item.rating}
            className="grid grid-cols-[40px_1fr_44px] items-center gap-2 body-small"
          >
            <span className="flex items-center gap-1 text-zinc-950">
              {item.rating}
              <StarFilledIcon className="text-point-600" />
            </span>
            <div className="h-3 rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-point-600"
                style={{ width: `${percent}%` }}
                title={`${item.rating}점 ${item.count.toLocaleString()}건`}
              />
            </div>
            <span className="text-right body-caption text-zinc-500">{Math.round(percent)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
