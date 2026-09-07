"use client";

import type { Booth } from "./types";

function BoothQueueUpdateBar({ booth }: { booth: Booth }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="body-small-bold wrap-anywhere text-zinc-950">{booth.name}</span>
          </div>
          <p className="body-caption text-zinc-500">
            혼잡도 {booth.congestionLevel ?? "미입력"} · 예상 대기시간{" "}
            {booth.waitMinutes == null ? "미입력" : `${booth.waitMinutes}분`}
          </p>
        </div>
      </div>

      {booth.lastQueueUpdater ? (
        <p className="body-caption min-w-0 wrap-anywhere text-zinc-500">
          최근 갱신: {booth.lastQueueUpdater.name}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardStatsBar({ selectedBooth }: { selectedBooth: Booth }) {
  return <BoothQueueUpdateBar booth={selectedBooth} />;
}
