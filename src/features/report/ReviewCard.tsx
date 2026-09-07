import { StarFilledIcon, StarIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import type { FestivalReviewItem } from "./types";

/** 별점 5개를 채움/빈 아이콘으로 표시한다. */
export function ReviewRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`5점 만점에 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((score) =>
        score <= Math.round(rating) ? (
          <StarFilledIcon key={score} className="size-3 text-point-600" />
        ) : (
          <StarIcon key={score} className="size-3 text-zinc-300" />
        ),
      )}
    </div>
  );
}

/** 방문객 대표 리뷰 카드(이름 + 별점 + 본문). 전체 리뷰 모달에서도 같은 카드를 쓴다. */
export function ReviewCard({
  review,
  className,
}: {
  review: FestivalReviewItem;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg bg-zinc-50 p-4", className)}>
      <div className="flex flex-col gap-0.5">
        <span className="body-small text-zinc-950">{review.displayName} 님</span>
        {review.rating === null ? null : <ReviewRating rating={review.rating} />}
      </div>
      <p className="body-small text-zinc-600">{review.content}</p>
    </div>
  );
}
