"use client";

import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

export interface MapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
  zoomInDisabled?: boolean;
  zoomOutDisabled?: boolean;
}

/** 지도 확대·축소에 공통으로 쓰는 36px 원형 버튼 묶음. 아이콘은 20px. */
export function MapZoomControls({
  onZoomIn,
  onZoomOut,
  className,
  zoomInDisabled = false,
  zoomOutDisabled = false,
}: MapZoomControlsProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <IconButton
        icon={<PlusIcon />}
        size="lg"
        iconClassName="size-5 text-zinc-950 [&_svg]:size-5"
        aria-label="지도 확대"
        disabled={zoomInDisabled}
        onClick={onZoomIn}
      />
      <IconButton
        icon={<MinusIcon />}
        size="lg"
        iconClassName="size-5 text-zinc-950 [&_svg]:size-5"
        aria-label="지도 축소"
        disabled={zoomOutDisabled}
        onClick={onZoomOut}
      />
    </div>
  );
}
