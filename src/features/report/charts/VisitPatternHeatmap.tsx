import type { VisitPatternRow } from "../types";

/**
 * 3-4. 일차/시간대별 방문 패턴 히트맵.
 * x축 = 시간대, y축 = 일차. 셀 색은 방문객 수를 최솟값~최댓값 구간 비율로 환산해
 * primary 계열 농도로 표현한다(차트 라이브러리 없이 CSS grid로만 그린다).
 */
export function VisitPatternHeatmap({ rows }: { rows: VisitPatternRow[] }) {
  const hours = rows[0]?.hours.map((cell) => cell.hour) ?? [];
  if (!rows.length || !hours.length)
    return <p className="body-small text-zinc-400">시간대별 데이터가 없습니다.</p>;

  const values = rows.flatMap((row) => row.hours.map((cell) => cell.visitorCount));
  const maximum = Math.max(...values);
  const minimum = Math.min(...values);
  // 최솟값~최댓값 구간을 0~100%로 늘려야 시간대 차이가 눈에 보인다.
  const toIntensity = (value: number) =>
    maximum === minimum ? 60 : Math.round(8 + ((value - minimum) / (maximum - minimum)) * 92);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="body-caption w-9 text-zinc-500" scope="col">
                <span className="sr-only">일차</span>
              </th>
              {hours.map((hour) => (
                <th key={hour} scope="col" className="body-caption font-normal text-zinc-500">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.dayIndex}>
                <th scope="row" className="body-caption pr-1 text-right font-normal text-zinc-500">
                  {row.dayIndex}일차
                </th>
                {row.hours.map((cell) => {
                  const intensity = toIntensity(cell.visitorCount);
                  return (
                    <td key={cell.hour} className="p-0">
                      <div
                        title={`${row.dayIndex}일차 ${cell.hour}시 · ${cell.visitorCount.toLocaleString()}명`}
                        className="size-6 rounded-sm"
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--color-primary-600) ${intensity}%, var(--color-zinc-100))`,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-2 body-caption text-zinc-500">
          <span>적음</span>
          <span
            className="h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--color-zinc-100), var(--color-primary-600))",
            }}
          />
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}
