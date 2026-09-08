import type { ReactNode } from "react";
import {
  CornersIcon,
  Crosshair2Icon,
  EnterIcon,
  ExitIcon,
  FaceIcon,
  GridIcon,
  RadiobuttonIcon,
  RulerHorizontalIcon,
} from "@radix-ui/react-icons";
import type { NodeType } from "./types";

/**
 * 노드 유형 → 라벨·아이콘 매핑.
 *
 * 지도 핀·부스 목록·유형 선택 메뉴·말풍선이 모두 이 한 곳을 본다. 예전에는 화면마다
 * 배열을 따로 들고 있어서 지도 핀만 유형과 무관하게 같은 점으로 그려졌고, 부스와
 * 화장실이 지도에서 구분되지 않았다. 아이콘은 Radix로 고정한다.
 */
export interface NodeTypeOption {
  value: NodeType;
  label: string;
  icon: ReactNode;
}

/** 점으로 찍는 유형. 입구·출구는 서로 반대 방향 아이콘이라 한눈에 갈린다. */
export const PIN_TYPE_OPTIONS: NodeTypeOption[] = [
  { value: "OTHER", label: "시설", icon: <RadiobuttonIcon /> },
  { value: "BOOTH", label: "부스", icon: <Crosshair2Icon /> },
  { value: "ENTRANCE", label: "입구", icon: <EnterIcon /> },
  { value: "EXIT", label: "출구", icon: <ExitIcon /> },
  { value: "RESTROOM", label: "화장실", icon: <FaceIcon /> },
];

export const POLYGON_TYPE_OPTIONS: NodeTypeOption[] = [
  { value: "OPEN_SPACE", label: "구역", icon: <CornersIcon /> },
  { value: "PARKING", label: "주차장", icon: <GridIcon /> },
];

export const LINE_TYPE_OPTIONS: NodeTypeOption[] = [
  { value: "PATH", label: "통로", icon: <RulerHorizontalIcon /> },
];

const OPTION_BY_TYPE = new Map<NodeType, NodeTypeOption>(
  [...PIN_TYPE_OPTIONS, ...POLYGON_TYPE_OPTIONS, ...LINE_TYPE_OPTIONS].map((option) => [
    option.value,
    option,
  ]),
);

/** 핀 메뉴에 없는 유형(STAGE·INFORMATION 등)은 기본 시설 라벨·아이콘으로 둔다. */
export const NODE_TYPE_LABEL: Partial<Record<NodeType, string>> = Object.fromEntries(
  [...OPTION_BY_TYPE].map(([type, option]) => [type, option.label]),
);

export function nodeTypeLabel(type: NodeType): string {
  return OPTION_BY_TYPE.get(type)?.label ?? "시설";
}

export function nodeTypeIcon(type: NodeType): ReactNode {
  return OPTION_BY_TYPE.get(type)?.icon ?? <RadiobuttonIcon />;
}
