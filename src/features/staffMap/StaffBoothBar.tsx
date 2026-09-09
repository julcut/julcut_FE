"use client";

import { Pencil2Icon } from "@radix-ui/react-icons";
import { MapMetric } from "@/components/map/MapMetric";
import { Button } from "@/components/ui/Button";
import { CongestionText } from "@/components/ui/CongestionBadge";
import { formatWaitMinutes } from "@/lib/formatWaitMinutes";
import type { Booth } from "@/features/dashboard/types";

const METRIC_LABEL_CLASSES = "body-small text-zinc-500 [&_svg]:size-3";

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
    <div className="absolute inset-x-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-10 rounded-2xl bg-white px-4 py-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <MapMetric
          value={
            <span className="truncate">
              {/* 구역은 거들고 부스 이름이 먼저 읽혀야 한다. */}
              <span className="body-regular">{zoneName}</span>{" "}
              <span className="text-[16px] leading-none">&gt;</span>{" "}
              <span className="body-regular-bold">{booth.name}</span>
            </span>
          }
          valueClassName="min-w-0 text-zinc-950"
          labelClassName={METRIC_LABEL_CLASSES}
          label="위치"
          description="선택한 부스가 속한 구역과 부스명입니다."
          className="min-w-0"
        />
        <Button
          variant="outline"
          size="sm"
          // 아이콘 14px, 아이콘–글자 간격 4, 안쪽 여백 좌우 16·상하 7.5.
          className="gap-1 px-4 py-[7.5px] [&_svg]:size-3.5"
          icon={<Pencil2Icon />}
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
          valueClassName="body-regular-bold"
          labelClassName={METRIC_LABEL_CLASSES}
          label="혼잡도"
          description="이 부스의 최신 혼잡도입니다."
        />
        <MapMetric
          value={queueTailZoneName ?? <span className="body-small text-zinc-400">미입력</span>}
          valueClassName="body-regular"
          labelClassName={METRIC_LABEL_CLASSES}
          label="줄끝"
          description="대기 줄의 끝이 마지막으로 기록된 구역입니다."
        />
        <MapMetric
          value={
            booth.waitMinutes == null ? (
              formatWaitMinutes(null)
            ) : (
              <>
                <span className="body-regular-bold">{booth.waitMinutes}</span> 분
              </>
            )
          }
          valueClassName="body-regular"
          labelClassName={METRIC_LABEL_CLASSES}
          label="예상 대기시간"
          description="이 부스의 최신 예상 대기시간입니다."
        />
      </div>

      {disabledReason ? <p className="body-caption mt-2 text-zinc-500">{disabledReason}</p> : null}
    </div>
  );
}
