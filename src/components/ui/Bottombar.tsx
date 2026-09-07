import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type BottombarType = "default" | "selected";

interface BottombarDefaultProps {
  type?: "default";
  cancelLabel?: string;
  submitLabel?: string;
  /** 생략하면 취소 버튼 없이 제출 버튼만 노출한다(예: 마이페이지 "수정하기"). */
  onCancel?: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  className?: string;
}

interface BottombarSelectedProps {
  type: "selected";
  count: number;
  deleteLabel?: string;
  onDelete: () => void;
  deleteDisabled?: boolean;
  className?: string;
}

export type BottombarProps = BottombarDefaultProps | BottombarSelectedProps;

const BASE_CLASSES =
  "fixed inset-x-0 bottom-0 z-20 flex h-[72px] w-full shrink-0 items-center border-t border-zinc-200 bg-white px-4 sm:px-10";

/**
 * 화면 하단 액션 바 — "default"(취소/등록)와 "selected"(N개 선택됨 + 삭제)
 * 두 상태를 가진다. Figma `Bottombar` 컴포넌트 스펙 그대로: 좌우 패딩 40px,
 * 상하 패딩 16px, 버튼 간격 12px.
 */
export function Bottombar(props: BottombarProps) {
  if (props.type === "selected") {
    const { count, deleteLabel = "삭제하기", onDelete, deleteDisabled, className } = props;
    return (
      <div className={cn(BASE_CLASSES, "justify-between", className)}>
        <p className="body-small text-zinc-950">
          <span className="body-small-bold text-primary">{count}</span>개 선택됨
        </p>
        <Button type="button" variant="destructive" disabled={deleteDisabled} onClick={onDelete}>
          {deleteLabel}
        </Button>
      </div>
    );
  }

  const {
    cancelLabel = "취소하기",
    submitLabel = "등록하기",
    onCancel,
    onSubmit,
    submitDisabled,
    className,
  } = props;

  return (
    <div className={cn(BASE_CLASSES, "justify-end gap-3", className)}>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button type="button" onClick={onSubmit} disabled={submitDisabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
