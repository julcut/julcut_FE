"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Cross1Icon,
  Crosshair2Icon,
  CornersIcon,
  DimensionsIcon,
  FaceIcon,
  GridIcon,
  HomeIcon,
  Pencil2Icon,
  RadiobuttonIcon,
  RulerHorizontalIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { MapOverlayCard } from "@/components/map/MapOverlayCard";
import type { NodeType } from "./types";

export type MapInfoPopoverMode = "group-create" | "zone-edit" | "booth-edit";
export type MapObjectTypeCategory = "pin" | "polygon" | "line";

const TYPE_LABEL: Record<MapInfoPopoverMode, string> = {
  "group-create": "구역",
  "zone-edit": "구역",
  "booth-edit": "부스",
};

const TYPE_CATEGORY_OPTIONS: { value: MapObjectTypeCategory; label: string; icon: ReactNode }[] = [
  { value: "pin", label: "핀", icon: <RadiobuttonIcon /> },
  { value: "polygon", label: "폴리곤", icon: <DimensionsIcon /> },
  { value: "line", label: "라인", icon: <RulerHorizontalIcon /> },
];

const PIN_TYPE_OPTIONS: { value: NodeType; label: string; icon: ReactNode }[] = [
  { value: "OTHER", label: "시설", icon: <RadiobuttonIcon /> },
  { value: "BOOTH", label: "부스", icon: <Crosshair2Icon /> },
  { value: "ENTRANCE", label: "입구", icon: <HomeIcon /> },
  { value: "EXIT", label: "출구", icon: <HomeIcon /> },
  { value: "RESTROOM", label: "화장실", icon: <FaceIcon /> },
];

const POLYGON_TYPE_OPTIONS: { value: NodeType; label: string; icon: ReactNode }[] = [
  { value: "OPEN_SPACE", label: "구역", icon: <CornersIcon /> },
  { value: "PARKING", label: "주차장", icon: <GridIcon /> },
];

const LINE_TYPE_OPTIONS: { value: NodeType; label: string; icon: ReactNode }[] = [
  { value: "PATH", label: "통로", icon: <RulerHorizontalIcon /> },
];

/**
 * 지도 위 핀/구역을 클릭했을 때 뜨는 말풍선 팝오버 — 그룹(구역) 생성, 구역 이름
 * 수정, 개별 부스 이름 수정 3가지 모드를 하나의 컴포넌트로 처리한다.
 * "상위구역"(중첩 구역)은 아직 지원하지 않아 항상 "-"로 고정 표시한다.
 */
export function MapInfoPopover({
  mode,
  initialName,
  style,
  onConfirm,
  onCancel,
  onDelete,
  onChangeType,
  onChangeNodeType,
  confirmLabel = "확인",
  hideCancel = false,
  typeLabel,
  parentZoneName = "-",
  showParentZone = true,
  hint,
}: {
  mode: MapInfoPopoverMode;
  initialName: string;
  style?: React.CSSProperties;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  /** 전달하면 유형 행 아래에 "유형 변경하기" 버튼을 노출한다(핀/폴리곤/라인 대분류 변경용). */
  onChangeType?: (type: MapObjectTypeCategory) => void;
  onChangeNodeType?: (type: NodeType) => void;
  /** 확인 버튼 라벨. 그룹(구역) 생성 직후 재편집 흐름에서는 "등록"으로 쓴다. */
  confirmLabel?: string;
  /**
   * true면 "취소" 버튼을 숨기고 삭제 버튼을 outline·flex-1로 확인 버튼과 나란히 둔다.
   * 삭제는 확인 모달을 띄우고, 수정/등록은 바로 적용한다.
   */
  hideCancel?: boolean;
  /** API 객체 유형에 따라 기본 유형 라벨을 덮어쓴다. */
  typeLabel?: string;
  /** 그룹 내 시설이면 소속 상위 구역명을 표시한다. */
  parentZoneName?: string;
  /** 상위구역 행을 감춘다. 도형처럼 구역에 속하지 않는 대상에 쓴다. */
  showParentZone?: boolean;
  /** 유형 아래에 덧붙일 한 줄 안내. 무엇을 고칠 수 있는지 알려 준다. */
  hint?: string;
}) {
  const [name, setName] = useState(initialName);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeCategory, setTypeCategory] = useState<MapObjectTypeCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 열리자마자 이름을 고칠 수 있게 커서를 넣고 기존 값을 모두 선택해 둔다.
  useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (pendingDelete) return;
      if (popoverRef.current?.contains(event.target as Node)) return;
      setTypeMenuOpen(false);
      setTypeCategory(null);
      onCancel();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || pendingDelete) return;
      setTypeMenuOpen(false);
      setTypeCategory(null);
      onCancel();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, pendingDelete]);

  return (
    <div ref={popoverRef} className="absolute z-20" style={style}>
      <MapOverlayCard showPointer>
        <div className="flex items-center gap-2">
          <span className="size-4 shrink-0 text-zinc-950 [&_svg]:size-4">
            <Pencil2Icon />
          </span>
          {/*
            테두리 없는 입력이라 제목처럼 보여, 고칠 수 있는 줄 모르고 "수정"만 눌렀다가
            아무 일도 안 일어난다는 이야기가 반복됐다. 열릴 때 커서를 넣어 바로 고칠 수
            있게 하고, 마우스를 올리면 입력칸 테두리를 보여 준다.
          */}
          <input
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름을 입력하세요"
            aria-label="이름"
            className="body-large-bold min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 text-zinc-950 outline-none hover:border-zinc-200 focus:border-primary"
          />
          <IconButton
            variant="ghost"
            size="sm"
            icon={<Cross1Icon />}
            aria-label="닫기"
            onClick={onCancel}
            className="-mr-1 shrink-0"
          />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="body-small text-zinc-500">유형</span>
            <span className="body-small text-zinc-950">{typeLabel ?? TYPE_LABEL[mode]}</span>
          </div>
          {onChangeType || onChangeNodeType ? (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<UpdateIcon />}
                onClick={() => setTypeMenuOpen((prev) => !prev)}
                className="w-full"
              >
                유형 변경하기
              </Button>
              {typeMenuOpen ? (
                <div className="absolute top-full left-0 z-10 mt-1 w-21 rounded-md border border-zinc-200 bg-white p-2 shadow-md">
                  {TYPE_CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (onChangeNodeType) {
                          setTypeCategory(option.value);
                          return;
                        }
                        onChangeType?.(option.value);
                        setTypeMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-sm py-2 text-left hover:bg-zinc-100"
                    >
                      <span className="size-4 shrink-0 text-zinc-500">{option.icon}</span>
                      <span className="body-small flex-1 text-zinc-950">{option.label}</span>
                    </button>
                  ))}
                  {typeCategory ? (
                    <div
                      className={`absolute top-0 left-full ml-2 rounded-md border border-zinc-200 bg-white p-2 shadow-md ${
                        typeCategory === "pin" ? "w-25" : "w-21"
                      }`}
                    >
                      {(typeCategory === "pin"
                        ? PIN_TYPE_OPTIONS
                        : typeCategory === "polygon"
                          ? POLYGON_TYPE_OPTIONS
                          : LINE_TYPE_OPTIONS
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            onChangeNodeType?.(option.value);
                            setTypeCategory(null);
                            setTypeMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 border-b border-zinc-200 py-2 text-left last:border-b-0 hover:bg-zinc-100"
                        >
                          <span className="size-4 shrink-0 text-primary [&_svg]:size-4">
                            {option.icon}
                          </span>
                          <span className="body-small text-zinc-950">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {hint ? <p className="body-caption text-zinc-500">{hint}</p> : null}
          {showParentZone ? (
            <div className="flex items-center justify-between">
              <span className="body-small text-zinc-500">상위구역</span>
              <span className="body-small text-zinc-950">{parentZoneName}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {onDelete && hideCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(true)}
              className="flex-1"
            >
              삭제
            </Button>
          ) : null}
          {onDelete && !hideCancel ? (
            <Button
              type="button"
              variant="link"
              onClick={onDelete}
              className="text-error mr-auto px-0"
            >
              삭제
            </Button>
          ) : null}
          {hideCancel ? null : (
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              취소
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(name.trim() || initialName)}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </MapOverlayCard>

      {hideCancel && onDelete ? (
        <ConfirmDialog
          open={pendingDelete}
          onOpenChange={setPendingDelete}
          title="삭제하시겠습니까?"
          confirmLabel="삭제"
          confirmVariant="destructive"
          onConfirm={() => {
            setPendingDelete(false);
            onDelete();
          }}
        />
      ) : null}
    </div>
  );
}
