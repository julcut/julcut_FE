"use client";

import { MapMetric } from "@/components/map/MapMetric";
import { CongestionText } from "@/components/ui/CongestionBadge";
import type { Booth, CongestionLevel } from "@/features/dashboard/types";

const METRIC_LABEL_CLASSES = "body-caption [&_svg]:size-3.5";

export interface StaffFestivalBarProps {
  title: string;
  congestionLevel: CongestionLevel | null;
  averageWaitMinutes: number | null;
  busiestBooth: Booth | null;
}

/** 부스를 선택하지 않았을 때 지도 위에 떠 있는 축제 전체 요약 카드. */
export function StaffFestivalBar({
  title,
  congestionLevel,
  averageWaitMinutes,
  busiestBooth,
}: StaffFestivalBarProps) {
  return (
    <div className="absolute inset-x-5 bottom-5 z-10 rounded-2xl bg-white p-4 shadow-lg">
      <p className="body-small-bold text-zinc-950">{title}</p>

      <div className="mt-2 flex items-start gap-5">
        <MapMetric
          value={
            congestionLevel ? (
              <CongestionText level={congestionLevel} />
            ) : (
              <span className="body-small text-zinc-400">데이터 없음</span>
            )
          }
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="혼잡도"
          description="혼잡도가 입력된 부스들의 평균 등급입니다."
        />
        <MapMetric
          value={
            averageWaitMinutes === null ? (
              <span className="body-small text-zinc-400">데이터 없음</span>
            ) : (
              `${averageWaitMinutes} 분`
            )
          }
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="예상 대기시간"
          description="현재 활성 대기열의 평균 대기시간입니다."
        />
        <MapMetric
          value={
            busiestBooth ? (
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-primary">1</span>
                <span className="truncate">{busiestBooth.name}</span>
              </span>
            ) : (
              <span className="body-small text-zinc-400">데이터 없음</span>
            )
          }
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="가장 혼잡한 부스"
          description="혼잡도가 가장 높은 부스입니다. 같으면 대기시간이 긴 부스를 먼저 보여줍니다."
          className="min-w-0"
        />
      </div>
    </div>
  );
}
