"use client";

import { UpdateIcon } from "@radix-ui/react-icons";
import { MapMetric } from "@/components/map/MapMetric";
import { Button } from "@/components/ui/Button";
import { CongestionText } from "@/components/ui/CongestionBadge";
import { formatWaitMinutes } from "@/lib/formatWaitMinutes";
import type { Booth } from "@/features/dashboard/types";

const METRIC_LABEL_CLASSES = "body-caption [&_svg]:size-3.5";

export interface StaffBoothBarProps {
  booth: Booth;
  zoneName: string;
  /** 줄끝이 현재 어느 구역까지 왔는지. 아직 갱신된 적이 없으면 비어 있다. */
  queueTailZoneName: string | null;
  /** 대기열이 만들어지지 않아 줄끝을 갱신할 수 없을 때의 안내 문구. */
  disabledReason: string | null;
  onUpdateQueue: () => void;
}

/** 부스를 선택했을 때 지도 위에 떠 있는 부스 요약 카드. */
export function StaffBoothBar({
  booth,
  zoneName,
  queueTailZoneName,
  disabledReason,
  onUpdateQueue,
}: StaffBoothBarProps) {
  return (
    <div className="absolute inset-x-5 bottom-5 z-10 rounded-2xl bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <MapMetric
          value={
            <span className="truncate">
              {zoneName} &gt; {booth.name}
            </span>
          }
          valueClassName="body-small-bold min-w-0"
          labelClassName={METRIC_LABEL_CLASSES}
          label="위치"
          description="선택한 부스가 속한 구역과 부스명입니다."
          className="min-w-0"
        />
        <Button
          variant="outline"
          size="sm"
          icon={<UpdateIcon />}
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          onClick={onUpdateQueue}
        >
          줄끝 갱신
        </Button>
      </div>

      <div className="mt-2 flex items-start gap-5">
        <MapMetric
          value={
            booth.congestionLevel ? (
              <CongestionText level={booth.congestionLevel} />
            ) : (
              <span className="body-small text-zinc-400">미입력</span>
            )
          }
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="혼잡도"
          description="이 부스의 최신 혼잡도입니다."
        />
        <MapMetric
          value={queueTailZoneName ?? <span className="body-small text-zinc-400">미입력</span>}
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="줄끝"
          description="대기 줄의 끝이 마지막으로 기록된 구역입니다."
        />
        <MapMetric
          value={formatWaitMinutes(booth.waitMinutes ?? null)}
          valueClassName="body-small-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="예상 대기시간"
          description="이 부스의 최신 예상 대기시간입니다."
        />
      </div>

      {disabledReason ? <p className="body-caption mt-2 text-zinc-500">{disabledReason}</p> : null}
    </div>
  );
}
