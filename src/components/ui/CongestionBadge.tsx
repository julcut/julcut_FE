import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CongestionLevel } from "@/features/dashboard/types";

const CONGESTION_BADGE_BASE_CLASSES = "h-auto rounded-md px-2 py-1 text-xs font-normal";

/** 혼잡도 등급 표시 문구. 등급을 직접 고르는 화면에서도 같은 문구를 쓴다. */
export const CONGESTION_LABEL: Record<CongestionLevel, string> = {
  LOW: "여유",
  MEDIUM: "보통",
  HIGH: "혼잡",
};

/** 혼잡도 등급별 채움 색. 뱃지 밖(선택 컨트롤 등)에서도 같은 색을 쓰도록 공개한다. */
export const CONGESTION_SOLID_CLASSES: Record<CongestionLevel, string> = {
  LOW: "bg-secondary-600 text-white hover:bg-secondary-600",
  MEDIUM: "bg-point-500 text-white hover:bg-point-500",
  HIGH: "bg-red-600 text-white hover:bg-red-600",
};

const CONGESTION_TEXT_CLASSES: Record<CongestionLevel, string> = {
  LOW: "text-secondary-600",
  MEDIUM: "text-point-500",
  HIGH: "text-red-600",
};

export function CongestionBadge({
  level,
  className,
}: {
  level: CongestionLevel;
  className?: string;
}) {
  return (
    <Badge
      className={cn(CONGESTION_BADGE_BASE_CLASSES, CONGESTION_SOLID_CLASSES[level], className)}
    >
      {CONGESTION_LABEL[level]}
    </Badge>
  );
}

/** 배지(pill) 없이 혼잡도 라벨만 색상 텍스트로 보여준다 (지도 팝업 등 배경이 이미 카드인 곳에서 사용). */
export function CongestionText({
  level,
  className,
}: {
  level: CongestionLevel;
  className?: string;
}) {
  return (
    <span className={cn("body-small-bold", CONGESTION_TEXT_CLASSES[level], className)}>
      {CONGESTION_LABEL[level]}
    </span>
  );
}
