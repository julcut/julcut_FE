"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { ReviewCard } from "./ReviewCard";
import type { FestivalReviewItem } from "./types";

/**
 * 5-1. 전체 리뷰 보기 모달.
 * 백엔드가 한 번에 내려주는 리뷰는 최신순 최대 50건이라, 그보다 많으면
 * `hasMore`로 안내만 한다(리뷰 페이징 엔드포인트가 아직 없다).
 */
export function AllReviewsDialog({
  open,
  onOpenChange,
  reviews,
  reviewCount,
  hasMore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviews: FestivalReviewItem[];
  reviewCount: number;
  hasMore: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-dimmed" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-30 flex max-h-[80vh] w-[720px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="heading-small text-zinc-950">전체 리뷰</Dialog.Title>
              <Dialog.Description className="mt-1 body-small text-zinc-500">
                총 {reviewCount.toLocaleString()}건의 방문객 리뷰
                {hasMore ? ` 중 최신 ${reviews.length.toLocaleString()}건` : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="닫기" className="text-zinc-950">
                <Cross2Icon className="size-6" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            {reviews.length ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {reviews.map((review, index) => (
                  <li key={review.reviewId ?? `${review.displayName}-${index}`}>
                    <ReviewCard review={review} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="body-small text-zinc-400">표시할 리뷰가 없습니다.</p>
            )}
          </div>

          {hasMore ? (
            <p className="mt-4 body-caption text-zinc-500">
              최신 리뷰부터 일부만 보여 주고 있습니다. 전체 목록은 추후 제공될 예정입니다.
            </p>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
