"use client";

import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { MapNoticeCard } from "@/components/map/MapNoticeCard";
import { cn } from "@/lib/utils";
import type { AiSuggestion } from "./types";

/** 지도 위에 고정 카드로 노출되는 AI 제안. 닫으면 해당 제안의 경로선도 지도에서 같이 사라진다. */
export function AiSuggestionPanel({
  suggestions,
  onDismiss,
  className,
}: {
  suggestions: AiSuggestion[];
  onDismiss: (id: string) => void;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {suggestions.map((suggestion) => (
        <MapNoticeCard
          key={suggestion.id}
          className="w-full"
          title={suggestion.title}
          description={suggestion.description}
          descriptionIcon={<ExclamationTriangleIcon className="size-4 text-zinc-950" />}
          onClose={() => onDismiss(suggestion.id)}
        />
      ))}
    </div>
  );
}
