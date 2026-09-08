"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon, TargetIcon } from "@radix-ui/react-icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import { cn } from "@/lib/utils";
import type { Booth, BoothZone } from "./types";

function ZoneSection({
  zone,
  open,
  onOpenChange,
  selectedBoothId,
  onSelectBooth,
}: {
  zone: BoothZone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBoothId: string | undefined;
  onSelectBooth: (booth: Booth) => void;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-b border-zinc-200 last:border-b-0"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-lg px-2 py-3 text-left hover:bg-zinc-100">
        {open ? (
          <ChevronDownIcon className="size-5 shrink-0 text-zinc-950" />
        ) : (
          <ChevronRightIcon className="size-5 shrink-0 text-zinc-950" />
        )}
        <span className="body-regular-bold text-zinc-950">{zone.name}</span>
        <span className="body-regular-bold text-primary">{zone.booths.length}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="flex flex-col gap-1 pb-3 pl-6">
          {zone.booths.map((booth) => {
            const isSelected = selectedBoothId === booth.boothId;
            return (
              <li key={booth.boothId}>
                <button
                  type="button"
                  onClick={() => onSelectBooth(booth)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg px-2 py-2.5 text-left hover:bg-zinc-100",
                    isSelected && "bg-zinc-100",
                  )}
                >
                  <TargetIcon className="size-4 shrink-0 text-primary" />
                  <span className="body-regular truncate text-zinc-950">{booth.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface BoothZoneListProps {
  zones: BoothZone[];
  selectedBoothId: string | undefined;
  onSelectBooth: (booth: Booth) => void;
  /** 목록 위에 표시할 제목. 기본값은 "축제부스". */
  title?: string;
  /** 부스가 한 개도 없을 때 목록 자리에 보여줄 안내. 생략하면 아무것도 그리지 않는다. */
  emptyContent?: ReactNode;
  className?: string;
}

/**
 * 구역(존)별로 접히는 부스 목록. 관리자 대시보드 사이드바와 스태프 부스 찾기 화면이
 * 같은 목록을 쓰기 때문에 패널 셸과 분리해 둔다. 한 번에 한 구역만 펼쳐진다.
 */
export function BoothZoneList({
  zones,
  selectedBoothId,
  onSelectBooth,
  title = "축제부스",
  emptyContent,
  className,
}: BoothZoneListProps) {
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const boothCount = zones.reduce((total, zone) => total + zone.booths.length, 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="body-large-bold px-2 py-1.5 text-zinc-950">
        {title} <span className="text-primary">{boothCount}</span>
      </p>
      {boothCount === 0 ? (
        emptyContent
      ) : (
        <div className="flex flex-col gap-1">
          {zones.map((zone) => (
            <ZoneSection
              key={zone.zoneId}
              zone={zone}
              open={openZoneId === zone.zoneId}
              onOpenChange={(open) => setOpenZoneId(open ? zone.zoneId : null)}
              selectedBoothId={selectedBoothId}
              onSelectBooth={onSelectBooth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BoothTreeSidebar({
  zones,
  selectedBoothId,
  onSelectBooth,
  emptyContent,
  className,
}: {
  zones: BoothZone[];
  selectedBoothId: string | undefined;
  onSelectBooth: (booth: Booth) => void;
  emptyContent?: ReactNode;
  className?: string;
}) {
  return (
    <MapSidePanel className={className}>
      <BoothZoneList
        zones={zones}
        selectedBoothId={selectedBoothId}
        onSelectBooth={onSelectBooth}
        emptyContent={emptyContent}
      />
    </MapSidePanel>
  );
}
