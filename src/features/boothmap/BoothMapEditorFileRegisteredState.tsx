"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomOverlayMap, Map as KakaoMap, Polygon, Polyline } from "react-kakao-maps-sdk";
import {
  Cross2Icon,
  Crosshair2Icon,
  DimensionsIcon,
  FaceIcon,
  FileIcon,
  HamburgerMenuIcon,
  HomeIcon,
  RadiobuttonIcon,
  ResetIcon,
  RulerHorizontalIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { MapSidePanel } from "@/components/map/MapSidePanel";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { getManagedFestival } from "@/features/festivals/api";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api/httpError";
import { useConsoleUiStore } from "@/store/consoleUiStore";
import { cn } from "@/lib/utils";
import { ensureCoordinateMap, getMapEditor, replaceFestivalMap, saveMapEditor } from "./api";
import {
  boothIdsToNodeIds,
  boothMapPinsToNodeChanges,
  nodeToLocalBooth,
  nodeToLocalShape,
  SHAPE_MINIMUM_POINTS,
  type LocalBoothPin,
  type LocalMapShape,
} from "./geometryWgs84";
import { MapAnalysisProgressCard } from "./MapAnalysisProgressCard";
import { MapInfoPopover } from "./MapInfoPopover";
import { fitBoothBounds } from "./fitBoothBounds";
import { primaryFestivalCenter } from "./mapCenter";
import type { CreateCoordinateMapResponse, MapAnalysisStatusResponse, NodeType } from "./types";
import { useEditHistory } from "./useEditHistory";
import { useMapAnalysis } from "./useMapAnalysis";
import { ZoneListItem } from "./ZoneListItem";

let cachedEmptyDragImage: HTMLImageElement | null = null;
/** 드래그 고스트를 숨기는 데 쓰는 1x1 투명 GIF — data URI라 동기적으로 디코딩된다. */
function getEmptyDragImage(): HTMLImageElement {
  if (!cachedEmptyDragImage) {
    const image = new Image();
    image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    cachedEmptyDragImage = image;
  }
  return cachedEmptyDragImage;
}

interface LocalZone {
  id: string;
  name: string;
  boothIds: string[];
}

function createZoneId() {
  return crypto.randomUUID();
}

const NODE_TYPE_LABEL: Partial<Record<NodeType, string>> = {
  OTHER: "시설",
  BOOTH: "부스",
  ENTRANCE: "입구",
  EXIT: "출구",
  RESTROOM: "화장실",
};

/** 구역 멤버를 감싸는 최소 볼록 다각형에 여백을 더해 구역 경계를 만든다. */
function zonePolygonPath(members: LocalBoothPin[]) {
  const pad = 0.0006;
  const points = members
    .map(({ lat, lng }) => ({ lat, lng }))
    .sort((a, b) => a.lng - b.lng || a.lat - b.lat);

  if (points.length < 3) {
    const lats = points.map((point) => point.lat);
    const lngs = points.map((point) => point.lng);
    return [
      { lat: Math.max(...lats) + pad, lng: Math.min(...lngs) - pad },
      { lat: Math.max(...lats) + pad, lng: Math.max(...lngs) + pad },
      { lat: Math.min(...lats) - pad, lng: Math.max(...lngs) + pad },
      { lat: Math.min(...lats) - pad, lng: Math.min(...lngs) - pad },
    ];
  }

  const cross = (
    origin: (typeof points)[number],
    a: (typeof points)[number],
    b: (typeof points)[number],
  ) => (a.lng - origin.lng) * (b.lat - origin.lat) - (a.lat - origin.lat) * (b.lng - origin.lng);
  const halfHull = (source: typeof points) => {
    const hull: typeof points = [];
    source.forEach((point) => {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    });
    return hull;
  };
  const hull = [...halfHull(points).slice(0, -1), ...halfHull([...points].reverse()).slice(0, -1)];
  const center = centroidOf(members);
  return hull.map((point) => ({
    lat: point.lat + (point.lat >= center.lat ? pad : -pad),
    lng: point.lng + (point.lng >= center.lng ? pad : -pad),
  }));
}

function centroidOf(members: LocalBoothPin[]) {
  return {
    lat: members.reduce((sum, booth) => sum + booth.lat, 0) / members.length,
    lng: members.reduce((sum, booth) => sum + booth.lng, 0) / members.length,
  };
}

const POPOVER_ANCHORS = { xAnchor: 0.5, yAnchor: 1 } as const;

/** 지도에서 고를 수 있는 그리기 도구. 설계서 "5. 오버레이 버튼 영역2"의 핀·폴리곤·라인이다. */
type DrawTool = "select" | "pin" | "polygon" | "line";

/** 폴리곤·라인의 기본 노드 유형. 세부 유형은 도형을 고른 뒤 팝오버에서 바꾼다. */
const SHAPE_NODE_TYPE: Record<"polygon" | "line", NodeType> = {
  polygon: "OPEN_SPACE",
  line: "PATH",
};
const SHAPE_LABEL: Record<"polygon" | "line", string> = {
  polygon: "구역",
  line: "통로",
};

/** 도형 이름표와 팝오버를 띄울 기준점. 폴리곤은 무게중심, 라인은 가운데 꼭짓점을 쓴다. */
function shapeAnchor(shape: LocalMapShape) {
  if (shape.kind === "line") {
    return shape.points[Math.floor(shape.points.length / 2)];
  }
  return {
    lat: shape.points.reduce((sum, point) => sum + point.lat, 0) / shape.points.length,
    lng: shape.points.reduce((sum, point) => sum + point.lng, 0) / shape.points.length,
  };
}

/**
 * 카카오맵에서 부스 핀을 찍고 구역을 묶는 편집 화면.
 *
 * 배치도 이미지를 올리면 AI가 부스를 찾아 핀으로 뿌려주고(schema 2.0 위경도),
 * 관리자는 그 핀을 끌어 보정한다. 분석이 도는 동안에는 백엔드가 저장을 거부하므로
 * 편집·저장을 화면에서도 막는다.
 */
export function BoothMapEditorFileRegisteredState({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setHideNav = useConsoleUiStore((state) => state.setHideNav);
  const setFullBleed = useConsoleUiStore((state) => state.setFullBleed);
  const [zoomStep, setZoomStep] = useState(0);
  const [boothListOpen, setBoothListOpen] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("select");
  const [pendingPinType, setPendingPinType] = useState<NodeType>("BOOTH");
  const [pinTypeMenuOpen, setPinTypeMenuOpen] = useState(false);
  const [mapLoading, mapError] = useKakaoMapLoader();
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const kakaoMapRef = useRef<kakao.maps.Map | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  /*
    지도 위에서 끌고 있는 핀의 임시 위치. 끄는 동안에는 booths를 건드리지 않고 이 값만
    갱신한다 — 매 프레임 booths를 바꾸면 드래그 한 번에 실행취소 기록이 수십 개 쌓인다.
    실제 좌표는 손을 뗄 때 한 번만 반영해 되돌리기 한 번으로 원위치되게 한다.
  */
  const [draggingPin, setDraggingPin] = useState<{ id: string; lat: number; lng: number } | null>(
    null,
  );
  /** 드래그로 끝난 포인터인지. 이 값이 true면 이어서 오는 click을 무시한다. */
  const pinDraggedRef = useRef(false);
  /** 핀 위에 커서가 올라와 있는지. 지도 드래그 잠금을 언제 풀지 판단하는 데 쓴다. */
  const pinHoveredRef = useRef(false);
  /** 지금 핀을 끌고 있는지. 상태(draggingPin)는 이벤트 핸들러에서 늦게 보여 ref로 따로 둔다. */
  const pinDraggingRef = useRef(false);
  const festivalQuery = useQuery({
    queryKey: ["managed-festival", festivalId],
    queryFn: () => getManagedFestival(festivalId),
  });
  const mapQuery = useQuery({
    queryKey: ["coordinate-map", festivalId],
    queryFn: () => ensureCoordinateMap(festivalId),
    // 축제 장소에 위경도가 없으면 400이 확정이라 재시도하지 않고 바로 안내한다.
    retry: false,
  });
  const editorQuery = useQuery({
    queryKey: ["map-editor", festivalId, mapQuery.data?.mapId],
    queryFn: () => getMapEditor(festivalId, mapQuery.data!.mapId),
    enabled: !!mapQuery.data?.mapId,
  });
  const festivalCenter = useMemo(
    () => primaryFestivalCenter(festivalQuery.data?.locations),
    [festivalQuery.data?.locations],
  );

  const [booths, setBooths] = useState<LocalBoothPin[]>([]);
  const [editRevision, setEditRevision] = useState(0);
  const [deletedNodeIds, setDeletedNodeIds] = useState<string[]>([]);
  // 로컬 상태를 서버 데이터로 다시 채워야 할 때 올리는 값. 지도가 바뀌거나 AI 분석이
  // 끝나면 올라간다. 편집 중인 내용을 임의로 날리지 않도록 그 두 경우에만 올린다.
  const [seedToken, setSeedToken] = useState(0);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const [analyzeDialogOpen, setAnalyzeDialogOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editingBoothId, setEditingBoothId] = useState<string | null>(null);
  const [zones, setZones] = useState<LocalZone[]>([]);
  /** 지도 위에 직접 그린 폴리곤·라인. 서버의 POLYGON/POLYLINE 노드와 1:1로 대응한다. */
  const [shapes, setShapes] = useState<LocalMapShape[]>([]);
  /** 지금 찍고 있는 도형의 꼭짓점들. "그리기 완료"를 눌러야 shapes로 넘어간다. */
  const [draftPoints, setDraftPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(new Set());

  const zoneIdByBoothId = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((zone) => zone.boothIds.forEach((id) => map.set(id, zone.id)));
    return map;
  }, [zones]);
  const ungroupedBooths = useMemo(
    () => booths.filter((booth) => !zoneIdByBoothId.has(booth.id)),
    [booths, zoneIdByBoothId],
  );
  // 그룹(구역)에 속한 부스 핀은 그 구역이 선택됐을 때만 지도에 노출한다 —
  // "4-4. 축제부스지도 - 아무것도 선택하지 않은 경우" 화면설계서 기준(최상위구역 폴리곤만 노출).
  const visibleBooths = useMemo(
    () =>
      booths.filter((booth) => {
        const zoneId = zoneIdByBoothId.get(booth.id);
        return !zoneId || zoneId === selectedZoneId;
      }),
    [booths, zoneIdByBoothId, selectedZoneId],
  );

  function toggleZoneExpanded(id: string) {
    setExpandedZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectZone(zoneId: string) {
    setCheckedIds(new Set());
    setSelectedZoneId(zoneId);
    setExpandedZoneIds((prev) => new Set(prev).add(zoneId));
  }

  // 체크박스 1개만 선택되면 해당 마커로 시선 이동 + 편집 모달 노출.
  // 2개 이상이면 모달 대신 "선택 항목 그룹화" 버튼을 보여준다.
  const selectedId = editingBoothId;
  const selectedBooth = useMemo(
    () => booths.find((booth) => booth.id === selectedId) ?? null,
    [booths, selectedId],
  );
  const selectedBoothZone = useMemo(
    () =>
      selectedBooth
        ? (zones.find((zone) => zone.boothIds.includes(selectedBooth.id)) ?? null)
        : null,
    [selectedBooth, zones],
  );
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );
  const selectedZoneMembers = useMemo(
    () => (selectedZone ? booths.filter((booth) => selectedZone.boothIds.includes(booth.id)) : []),
    [selectedZone, booths],
  );

  useEffect(() => {
    if (!selectedBooth || !kakaoMapRef.current || !window.kakao?.maps) return;
    kakaoMapRef.current.panTo(new window.kakao.maps.LatLng(selectedBooth.lat, selectedBooth.lng));
  }, [selectedBooth]);

  // 서버 데이터를 새로 받을 때마다(최초 진입, AI 분석 완료 등) 부스 전체가 보이도록
  // 한 번 맞춘다. 그 뒤로는 사용자가 옮기고 확대한 위치를 존중한다.
  const [fittedKey, setFittedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!seededKey || fittedKey === seededKey || mapLoading) return;
    if (fitBoothBounds(kakaoMapRef.current, booths)) setFittedKey(seededKey);
  }, [fittedKey, seededKey, mapLoading, booths]);
  const pendingGroupMembers = useMemo(
    () => (groupPopoverOpen ? booths.filter((booth) => checkedIds.has(booth.id)) : []),
    [booths, checkedIds, groupPopoverOpen],
  );
  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
  );
  const mapCenter = editorQuery.data?.center ?? mapQuery.data?.center ?? festivalCenter;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!mapQuery.data?.mapId) {
        throw new Error("지도 정보를 불러오지 못했습니다.");
      }
      // 부스를 전부 지운 경우에도 삭제 내역은 서버에 보내야 하므로, 지울 노드가 있으면 통과시킨다.
      if (booths.length === 0 && shapes.length === 0 && deletedNodeIds.length === 0) {
        throw new Error("저장할 부스가 없습니다.");
      }
      return saveMapEditor(festivalId, mapQuery.data.mapId, {
        baseRevision: editRevision,
        nodes: boothMapPinsToNodeChanges(booths, deletedNodeIds, shapes),
        zones: zones
          .map((zone, sortOrder) => ({
            zoneId: zone.id,
            name: zone.name,
            sortOrder,
            boothNodeIds: boothIdsToNodeIds(zone.boothIds, booths),
          }))
          .filter((zone) => zone.boothNodeIds.length > 0),
      });
    },
    onSuccess: async (response) => {
      setEditRevision(response.editRevision);
      setDeletedNodeIds([]);
      await queryClient.invalidateQueries({ queryKey: ["map-editor", festivalId] });
      const editor = await getMapEditor(festivalId, mapQuery.data!.mapId);
      setBooths(
        editor.nodes
          .map(nodeToLocalBooth)
          .filter((booth): booth is LocalBoothPin => booth !== null),
      );
      setShapes(
        editor.nodes
          .map(nodeToLocalShape)
          .filter((shape): shape is LocalMapShape => shape !== null),
      );
      setZones(
        (editor.zones ?? []).map((zone) => ({
          id: zone.zoneId,
          name: zone.name,
          boothIds: zone.boothNodeIds
            .map((nodeId) =>
              editor.nodes.find((node) => node.nodeId === nodeId) ? `node-${nodeId}` : null,
            )
            .filter((id): id is string => id !== null),
        })),
      );
      // 저장된 상태를 새 기준으로 삼는다(다음 렌더에서 현재 스냅샷으로 다시 채워진다).
      setSavedSnapshot(null);
      // 저장 직후 화면 상태를 "저장된 상태"로 다시 기준 잡는다.
      setSeedToken((token) => token + 1);
      toast.success("부스맵이 저장되었습니다.");
    },
    onError: async (error) => {
      if (getApiErrorCode(error) === 40910) {
        toast.error("다른 곳에서 수정되었습니다.", {
          description: "최신 데이터를 다시 불러옵니다.",
        });
        await queryClient.invalidateQueries({ queryKey: ["map-editor", festivalId] });
        if (mapQuery.data?.mapId) {
          const editor = await getMapEditor(festivalId, mapQuery.data.mapId);
          setEditRevision(editor.editRevision);
          setBooths(
            editor.nodes
              .map(nodeToLocalBooth)
              .filter((booth): booth is LocalBoothPin => booth !== null),
          );
          setShapes(
            editor.nodes
              .map(nodeToLocalShape)
              .filter((shape): shape is LocalMapShape => shape !== null),
          );
          setDeletedNodeIds([]);
        }
        return;
      }
      toast.error(getApiErrorMessage(error, "부스맵 저장에 실패했습니다."));
    },
  });
  const replaceMutation = useMutation({
    mutationFn: (file: File) => {
      if (!mapQuery.data?.mapId) throw new Error("지도 정보를 불러오지 못했습니다.");
      return replaceFestivalMap(festivalId, mapQuery.data.mapId, file);
    },
    onSuccess: async (summary) => {
      // 지도가 통째로 교체됐으므로 편집기 쿼리 키에 쓰이는 mapId를 먼저 바꿔야 한다.
      // 옛 mapId로 편집기를 다시 부르면 로드맵의 현재 지도와 어긋나 409가 난다.
      queryClient.setQueryData(
        ["coordinate-map", festivalId],
        (previous: CreateCoordinateMapResponse | undefined) =>
          previous ? { ...previous, mapId: summary.mapId } : previous,
      );
      await queryClient.invalidateQueries({ queryKey: ["coordinate-map", festivalId] });
      await queryClient.invalidateQueries({ queryKey: ["map-editor", festivalId] });
      await queryClient.invalidateQueries({ queryKey: ["map-analysis", festivalId] });
      toast.success("배치도를 올렸습니다.", {
        description: "AI가 부스를 찾는 동안 편집과 저장은 잠시 막힙니다.",
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "배치도 업로드에 실패했습니다.")),
  });

  // 분석이 끝나면 서버가 새로 저장한 AI 노드를 받아 화면 상태를 다시 채운다.
  const handleAnalysisCompleted = useCallback(
    async (status: MapAnalysisStatusResponse) => {
      await queryClient.invalidateQueries({ queryKey: ["map-editor", festivalId] });
      setSeedToken((token) => token + 1);
      if (status.acceptedCount > 0) {
        toast.success(`부스 후보 ${status.acceptedCount}개를 찾았습니다.`, {
          description:
            status.rejectedCount > 0
              ? `읽지 못한 ${status.rejectedCount}개는 제외했습니다. 위치와 이름을 확인해 주세요.`
              : "위치와 이름을 확인한 뒤 저장해 주세요.",
        });
        return;
      }
      toast.info("배치도에서 부스를 찾지 못했습니다.", {
        description: "핀 도구로 직접 찍거나, 더 선명한 배치도로 다시 시도해 주세요.",
      });
    },
    [festivalId, queryClient],
  );

  const analysis = useMapAnalysis({
    festivalId,
    mapId: mapQuery.data?.mapId,
    onCompleted: handleAnalysisCompleted,
  });
  // 분석 중에는 백엔드가 저장을 거부한다. 화면에서 막지 않으면 의미 없는 409만 돌아온다.
  const analyzing = analysis.isRunning || editorQuery.data?.roadmapStatus === "ANALYZING";
  /*
    종료된 축제의 부스 배치는 결과리포트의 근거 자료라 뒤늦게 바뀌면 안 된다.
    축제관리의 진입 버튼만 숨기면 주소를 직접 입력해 편집하고 저장까지 할 수 있어,
    편집기 자체를 분석 중과 같은 방식으로 잠근다. 보기는 막지 않는다 —
    지난 축제의 배치를 확인하는 것은 정당한 사용이다.
  */
  const isCompleted = festivalQuery.data?.progressStatus === "COMPLETED";
  const editingLocked = analyzing || isCompleted;
  const editLockReason = isCompleted
    ? "종료된 축제의 부스맵은 수정할 수 없습니다."
    : analyzing
      ? "AI 분석이 끝난 뒤에 편집할 수 있습니다."
      : null;
  const saveLockReason = isCompleted
    ? "종료된 축제의 부스맵은 저장할 수 없습니다."
    : analyzing
      ? "AI 분석이 끝난 뒤에 저장할 수 있습니다."
      : undefined;
  const hasBlueprintImage = !!editorQuery.data?.displayImageUrl;
  const reviewRequiredCount = booths.filter((booth) => booth.uncertain).length;

  // 편집기 데이터가 도착하면 로컬 상태를 채운다(렌더 중 조정 — effect가 아니다).
  // 같은 지도·같은 seedToken에서는 한 번만 채워 사용자의 편집을 덮어쓰지 않는다.
  const seedKey = editorQuery.data ? `${editorQuery.data.mapId}:${seedToken}` : null;
  if (editorQuery.data && seedKey !== null && seedKey !== seededKey) {
    setBooths(
      editorQuery.data.nodes
        .map(nodeToLocalBooth)
        .filter((booth): booth is LocalBoothPin => booth !== null),
    );
    setShapes(
      editorQuery.data.nodes
        .map(nodeToLocalShape)
        .filter((shape): shape is LocalMapShape => shape !== null),
    );
    setDraftPoints([]);
    setSelectedShapeId(null);
    setEditRevision(editorQuery.data.editRevision);
    setZones(
      (editorQuery.data.zones ?? []).map((zone) => ({
        id: zone.zoneId,
        name: zone.name,
        boothIds: zone.boothNodeIds.map((nodeId) => `node-${nodeId}`),
      })),
    );
    setDeletedNodeIds([]);
    setCheckedIds(new Set());
    setEditingBoothId(null);
    setSelectedZoneId(null);
    setSeededKey(seedKey);
  }

  // 저장하지 않은 편집이 있는지. 브라우저 뒤로가기·탭 닫기로 작업이 사라지는 것을 막는 데 쓴다.
  const currentSnapshot = useMemo(
    () => JSON.stringify({ booths, shapes, zones, deletedNodeIds }),
    [booths, shapes, zones, deletedNodeIds],
  );
  // 서버 데이터를 새로 채울 때마다(지도 교체·AI 분석 완료) 기준 스냅샷도 다시 잡는다.
  // 그러지 않으면 AI가 뿌린 부스가 곧바로 "저장하지 않은 편집"으로 잡힌다.
  const [savedSnapshot, setSavedSnapshot] = useState<{ key: string; value: string } | null>(null);
  if (seededKey !== null && savedSnapshot?.key !== seededKey) {
    setSavedSnapshot({ key: seededKey, value: currentSnapshot });
  }
  const hasUnsavedChanges = savedSnapshot !== null && savedSnapshot.value !== currentSnapshot;

  // 실행취소/다시실행으로 되돌아온 스냅샷을 화면 상태에 다시 적용한다.
  // 여기서 복원한 결과는 currentSnapshot과 글자까지 같아지므로 히스토리에 다시 쌓이지 않는다.
  const restoreSnapshot = useCallback((value: string) => {
    const restored = JSON.parse(value) as {
      booths: LocalBoothPin[];
      shapes?: LocalMapShape[];
      zones: LocalZone[];
      deletedNodeIds: string[];
    };
    setBooths(restored.booths);
    setShapes(restored.shapes ?? []);
    setZones(restored.zones);
    setDeletedNodeIds(restored.deletedNodeIds);
    setDraftPoints([]);
    setSelectedShapeId(null);
    // 되돌린 결과에 없는 부스를 가리키고 있을 수 있어 선택 상태는 비운다.
    setCheckedIds(new Set());
    setEditingBoothId(null);
    setSelectedZoneId(null);
    setGroupPopoverOpen(false);
  }, []);
  const { canUndo, canRedo, undo, redo } = useEditHistory({
    baselineKey: seededKey,
    snapshot: currentSnapshot,
    onRestore: restoreSnapshot,
  });
  const undoDisabled = !canUndo || editingLocked;
  const redoDisabled = !canRedo || editingLocked;

  // Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z 단축키.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      // 이름 입력 중에는 브라우저 기본 실행취소(글자 되돌리기)를 그대로 둔다.
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      if (event.shiftKey) {
        if (redoDisabled) return;
        event.preventDefault();
        redo();
        return;
      }
      if (undoDisabled) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, undoDisabled, redoDisabled]);

  // 그리는 중 단축키 — Enter로 확정, Esc로 그만두기, Backspace로 한 점 무르기.
  useEffect(() => {
    if (drawTool !== "polygon" && drawTool !== "line") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "Enter") {
        event.preventDefault();
        finishDraftShape();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelDraftShape();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        undoDraftPoint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // 그리기 상태(draftPoints)가 바뀔 때마다 최신 값을 보도록 다시 건다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawTool, draftPoints]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  function addBoothAt(lat: number, lng: number) {
    const id = crypto.randomUUID();
    setBooths((prev) => [
      ...prev,
      {
        id,
        nodeId: null,
        nodeType: pendingPinType,
        name: `${NODE_TYPE_LABEL[pendingPinType] ?? "시설"}명 ${prev.length + 1}`,
        lat,
        lng,
        isNew: true,
      },
    ]);
    if (selectedZoneId) {
      setZones((prev) =>
        prev.map((zone) =>
          zone.id === selectedZoneId ? { ...zone, boothIds: [...zone.boothIds, id] } : zone,
        ),
      );
    }
    setCheckedIds(new Set([id]));
    setEditingBoothId(id);
    setDrawTool("select");
    setPinTypeMenuOpen(false);
  }

  /** 폴리곤·라인 그리기를 시작한다. 같은 버튼을 다시 누르면 그리기를 접는다. */
  function startShapeTool(kind: "polygon" | "line") {
    setPinTypeMenuOpen(false);
    setSelectedShapeId(null);
    setEditingBoothId(null);
    setDraftPoints([]);
    setDrawTool((current) => (current === kind ? "select" : kind));
  }

  /** 그리는 중인 도형에 꼭짓점을 하나 더한다. */
  function addDraftPoint(lat: number, lng: number) {
    setDraftPoints((prev) => [...prev, { lat, lng }]);
  }

  /** 찍어 둔 꼭짓점으로 도형을 확정한다. 최소 점수를 못 채우면 아무 일도 하지 않는다. */
  function finishDraftShape() {
    if (drawTool !== "polygon" && drawTool !== "line") return;
    const kind = drawTool;
    if (draftPoints.length < SHAPE_MINIMUM_POINTS[kind]) return;
    const id = crypto.randomUUID();
    setShapes((prev) => [
      ...prev,
      {
        id,
        nodeId: null,
        name: `${SHAPE_LABEL[kind]}명 ${prev.filter((shape) => shape.kind === kind).length + 1}`,
        nodeType: SHAPE_NODE_TYPE[kind],
        kind,
        points: draftPoints,
        isNew: true,
      },
    ]);
    setDraftPoints([]);
    setDrawTool("select");
    setEditingBoothId(null);
    setSelectedShapeId(id);
  }

  function cancelDraftShape() {
    setDraftPoints([]);
    setDrawTool("select");
  }

  /** 마지막으로 찍은 꼭짓점 하나를 무른다. 그리는 중에는 실행취소 기록에 남기지 않는다. */
  function undoDraftPoint() {
    setDraftPoints((prev) => prev.slice(0, -1));
  }

  function deleteShape(shapeId: string) {
    const target = shapes.find((shape) => shape.id === shapeId);
    if (target?.nodeId) {
      setDeletedNodeIds((prev) => [...prev, target.nodeId!]);
    }
    setShapes((prev) => prev.filter((shape) => shape.id !== shapeId));
    setSelectedShapeId(null);
  }

  /** 끌고 있는 핀은 아직 booths에 반영되지 않았으므로 임시 위치를 대신 쓴다. */
  function pinPositionOf(booth: LocalBoothPin) {
    return draggingPin?.id === booth.id
      ? { lat: draggingPin.lat, lng: draggingPin.lng }
      : { lat: booth.lat, lng: booth.lng };
  }

  /**
   * 지도 위 핀을 끌어 위치를 옮긴다.
   *
   * 카카오맵 CustomOverlay에는 마커 같은 draggable 옵션이 없어 포인터 이벤트로 직접 처리한다.
   * 끄는 동안 지도가 같이 따라 움직이지 않도록 지도 드래그를 잠갔다가 손을 뗄 때 되돌린다.
   */
  function startPinDrag(booth: LocalBoothPin, event: React.PointerEvent<HTMLElement>) {
    // 핀 추가 모드에서는 지도 클릭이 곧 새 핀이라 이동을 받지 않는다.
    if (editingLocked || drawTool === "pin" || event.button !== 0) return;
    const map = kakaoMapRef.current;
    const wrapper = mapWrapperRef.current;
    if (!map || !wrapper || !window.kakao?.maps) return;

    event.preventDefault();
    event.stopPropagation();
    pinDraggedRef.current = false;
    pinDraggingRef.current = true;
    // 커서가 핀에 올라온 시점에 이미 잠갔지만, 터치처럼 hover 없이 바로 누르는 입력도 있다.
    map.setDraggable(false);

    const coordsAt = (clientX: number, clientY: number) => {
      const bounds = wrapper.getBoundingClientRect();
      return map
        .getProjection()
        .coordsFromContainerPoint(
          new window.kakao.maps.Point(clientX - bounds.left, clientY - bounds.top),
        );
    };

    const handleMove = (moveEvent: PointerEvent) => {
      pinDraggedRef.current = true;
      const coords = coordsAt(moveEvent.clientX, moveEvent.clientY);
      setDraggingPin({ id: booth.id, lat: coords.getLat(), lng: coords.getLng() });
    };
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      pinDraggingRef.current = false;
      // 손을 뗀 자리에 아직 핀이 있으면 잠금을 그대로 둔다 — 바로 다시 끌 수 있어야 한다.
      if (!pinHoveredRef.current) map.setDraggable(true);
      setDraggingPin(null);
      // 움직이지 않았다면 그냥 클릭이다. 이어지는 click 핸들러가 핀을 선택한다.
      if (!pinDraggedRef.current) return;
      const coords = coordsAt(upEvent.clientX, upEvent.clientY);
      setBooths((prev) =>
        prev.map((item) =>
          item.id === booth.id ? { ...item, lat: coords.getLat(), lng: coords.getLng() } : item,
        ),
      );
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  function toggleChecked(id: string) {
    setEditingBoothId(null);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [dragBoothId, setDragBoothId] = useState<string | null>(null);
  // 핸들 아이콘에서 시작한 드래그만 허용한다 — 행 전체를 draggable로 두면
  // 체크박스 클릭이나 텍스트 선택이 자꾸 드래그로 새서 부자연스러워진다.
  const [draggableRowId, setDraggableRowId] = useState<string | null>(null);

  function moveBooth(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setBooths((prev) => {
      const sourceIndex = prev.findIndex((booth) => booth.id === sourceId);
      const targetIndex = prev.findIndex((booth) => booth.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  useEffect(() => {
    setHideNav(true);
    setFullBleed(true);
    return () => {
      setHideNav(false);
      setFullBleed(false);
    };
  }, [setHideNav, setFullBleed]);

  useEffect(() => {
    const wrapper = mapWrapperRef.current;
    if (!wrapper) return;
    const handleWheel = (event: WheelEvent) => event.preventDefault();
    wrapper.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheel);
  }, [mapLoading, mapError]);

  function renderBoothRow(booth: LocalBoothPin, { indent }: { indent: boolean }) {
    return (
      <div
        key={booth.id}
        draggable={draggableRowId === booth.id}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          // 커서를 따라다니는 기본 드래그 고스트 이미지를 숨긴다 — src 없는
          // Image는 "로드 전" 취급돼 크로미움이 행 스냅샷으로 대체해버리므로,
          // 동기적으로 디코딩되는 1x1 투명 GIF data URI를 써서 확실히 비운다.
          event.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0);
          setDragBoothId(booth.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (dragBoothId && dragBoothId !== booth.id) moveBooth(dragBoothId, booth.id);
        }}
        onDrop={(event) => event.preventDefault()}
        onDragEnd={() => {
          setDragBoothId(null);
          setDraggableRowId(null);
        }}
        className={`flex items-center gap-2 rounded-md py-2 pl-1 transition-[background-color,opacity] duration-150 ${
          indent ? "pl-7" : ""
        } ${dragBoothId === booth.id ? "opacity-40" : ""} ${
          dragBoothId && dragBoothId !== booth.id ? "hover:bg-zinc-100" : ""
        }`}
      >
        {/* 구역 멤버는 서버가 부스만 받는다. 시설을 섞으면 저장 전체가 거부되므로 선택을 막는다. */}
        <span
          title={booth.nodeType === "BOOTH" ? undefined : "구역에는 부스만 묶을 수 있습니다."}
          className="flex"
        >
          <Checkbox
            checked={checkedIds.has(booth.id)}
            onCheckedChange={() => toggleChecked(booth.id)}
            disabled={booth.nodeType !== "BOOTH" || editingLocked}
            className="border-zinc-200"
          />
        </span>
        <button
          type="button"
          onClick={() => {
            setSelectedZoneId(zoneIdByBoothId.get(booth.id) ?? null);
            setCheckedIds(new Set([booth.id]));
            setEditingBoothId(booth.id);
          }}
          className="flex min-w-0 flex-1 items-center gap-1"
        >
          <span
            className={`size-4 shrink-0 ${booth.uncertain ? "text-secondary-600" : "text-primary"}`}
          >
            <RadiobuttonIcon />
          </span>
          <span className="body-regular truncate text-left text-zinc-950">{booth.name}</span>
          {booth.uncertain ? (
            <span className="body-caption shrink-0 rounded-full bg-secondary-600/10 px-1.5 text-secondary-600">
              검수
            </span>
          ) : null}
        </button>
        <span
          onMouseDown={() => {
            if (!editingLocked) setDraggableRowId(booth.id);
          }}
          onMouseUp={() => setDraggableRowId(null)}
          className={cn(
            "shrink-0 touch-none text-zinc-400",
            editingLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
          )}
        >
          <HamburgerMenuIcon />
        </span>
      </div>
    );
  }

  if (mapQuery.isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-50 px-8">
        <div className="max-w-md text-center">
          <p className="body-regular-bold text-zinc-950">
            {getApiErrorMessage(mapQuery.error, "부스맵을 준비하지 못했습니다.")}
          </p>
          <p className="body-small mt-2 text-zinc-500">
            축제 장소에 위도·경도가 없으면 부스맵을 만들 수 없습니다. 축제관리에서 주소를 다시
            검색해 좌표를 저장한 뒤 다시 시도해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 편집 데이터를 못 불러왔는데 그대로 열면 "부스 0개"로 보인다.
  // 그 상태에서 저장하면 서버에 있는 부스를 전부 지우는 요청이 나간다.
  if (editorQuery.isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-50 px-8">
        <div className="max-w-md text-center">
          <p className="body-regular-bold text-zinc-950">
            {getApiErrorMessage(editorQuery.error, "부스 정보를 불러오지 못했습니다.")}
          </p>
          <p className="body-small mt-2 text-zinc-500">
            편집 중인 부스가 사라지는 것을 막기 위해 편집기를 열지 않았습니다. 잠시 후 다시 시도해
            주세요.
          </p>
          <Button type="button" className="mt-4" onClick={() => editorQuery.refetch()}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (!mapCenter) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-50 px-8">
        <div className="max-w-md text-center">
          <p className="body-regular-bold text-zinc-950">축제 위치가 등록되지 않았습니다.</p>
          <p className="body-small mt-2 text-zinc-500">
            축제관리에서 주소를 검색해 위도·경도를 저장한 뒤 다시 시도해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-300">
      {!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || mapError || mapLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="body-small text-zinc-600">
            {!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
              ? "NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다."
              : mapError
                ? "카카오맵을 불러오지 못했습니다."
                : "지도를 불러오는 중..."}
          </p>
        </div>
      ) : (
        <div
          ref={mapWrapperRef}
          className={cn("absolute inset-0 isolate", drawTool !== "select" && "cursor-crosshair")}
        >
          <KakaoMap
            center={mapCenter}
            isPanto={false}
            level={2 + zoomStep}
            scrollwheel={false}
            className="h-full w-full"
            onCreate={(map) => {
              kakaoMapRef.current = map;
              map.setMinLevel(1);
              map.setMaxLevel(8);
            }}
            onClick={(_target, mouseEvent) => {
              if (editingLocked) return;
              const latLng = mouseEvent.latLng;
              if (!latLng) return;
              if (drawTool === "pin") {
                addBoothAt(latLng.getLat(), latLng.getLng());
                return;
              }
              if (drawTool === "polygon" || drawTool === "line") {
                addDraftPoint(latLng.getLat(), latLng.getLng());
              }
            }}
          >
            {pendingGroupMembers.length >= 2 ? (
              <>
                <Polygon
                  path={zonePolygonPath(pendingGroupMembers)}
                  fillColor="#236cf6"
                  fillOpacity={0.1}
                  strokeColor="#236cf6"
                  strokeWeight={2}
                  strokeOpacity={0.8}
                />
                {zonePolygonPath(pendingGroupMembers).map((point, index) => (
                  <CustomOverlayMap key={`pending-group-${index}`} position={point} zIndex={15}>
                    <span className="block size-2.5 rounded-full border-2 border-primary bg-white shadow" />
                  </CustomOverlayMap>
                ))}
              </>
            ) : null}
            {zones
              .filter((zone) => !selectedZoneId || zone.id === selectedZoneId)
              .map((zone) => {
                const members = booths.filter((booth) => zone.boothIds.includes(booth.id));
                if (members.length === 0) return null;
                const path = zonePolygonPath(members);
                return (
                  <Fragment key={zone.id}>
                    <Polygon
                      path={path}
                      fillColor="#236cf6"
                      fillOpacity={0.1}
                      strokeColor="#236cf6"
                      strokeWeight={2}
                      strokeOpacity={0.8}
                      onClick={() => selectZone(zone.id)}
                    />
                    {path.map((point, index) => (
                      <CustomOverlayMap key={`${zone.id}-${index}`} position={point} zIndex={15}>
                        <span className="block size-2.5 rounded-full border-2 border-primary bg-white shadow" />
                      </CustomOverlayMap>
                    ))}
                  </Fragment>
                );
              })}
            {shapes.map((shape) => {
              const selected = shape.id === selectedShapeId;
              const select = () => {
                setSelectedShapeId(shape.id);
                setEditingBoothId(null);
              };
              return shape.kind === "polygon" ? (
                <Polygon
                  key={shape.id}
                  path={shape.points}
                  fillColor="#236cf6"
                  fillOpacity={selected ? 0.25 : 0.1}
                  strokeColor="#236cf6"
                  strokeWeight={selected ? 3 : 2}
                  strokeOpacity={0.8}
                  onClick={select}
                />
              ) : (
                <Polyline
                  key={shape.id}
                  path={shape.points}
                  strokeColor="#236cf6"
                  strokeWeight={selected ? 6 : 4}
                  strokeOpacity={0.9}
                  onClick={select}
                />
              );
            })}
            {/* 그리는 중인 도형 — 확정 전이라 점선으로 구분해 보여 준다. */}
            {draftPoints.length >= 2 ? (
              drawTool === "polygon" && draftPoints.length >= 3 ? (
                <Polygon
                  path={draftPoints}
                  fillColor="#236cf6"
                  fillOpacity={0.1}
                  strokeColor="#236cf6"
                  strokeWeight={2}
                  strokeStyle="shortdash"
                />
              ) : (
                <Polyline
                  path={draftPoints}
                  strokeColor="#236cf6"
                  strokeWeight={3}
                  strokeStyle="shortdash"
                />
              )
            ) : null}
            {draftPoints.map((point, index) => (
              <CustomOverlayMap key={`draft-${index}`} position={point} zIndex={25}>
                <span className="block size-2.5 rounded-full border-2 border-primary bg-white shadow" />
              </CustomOverlayMap>
            ))}
            {visibleBooths.map((booth) => {
              const isSelected = booth.id === selectedId;
              return (
                <CustomOverlayMap
                  key={booth.id}
                  position={pinPositionOf(booth)}
                  clickable
                  zIndex={isSelected ? 20 : 10}
                >
                  <button
                    type="button"
                    title={editingLocked ? booth.name : `${booth.name} (끌어서 위치 이동)`}
                    aria-label={booth.name}
                    /*
                      카카오맵은 지도 엘리먼트에서 네이티브 mousedown을 먼저 잡아 패닝을
                      시작한다. React 핸들러는 그 뒤에 오므로 누른 다음 잠그면 이미 늦어
                      핀과 지도가 함께 움직인다. 커서가 핀에 올라온 순간 미리 잠근다.
                    */
                    onPointerEnter={() => {
                      pinHoveredRef.current = true;
                      if (!editingLocked && drawTool !== "pin") {
                        kakaoMapRef.current?.setDraggable(false);
                      }
                    }}
                    onPointerLeave={() => {
                      pinHoveredRef.current = false;
                      if (!pinDraggingRef.current) kakaoMapRef.current?.setDraggable(true);
                    }}
                    onPointerDown={(event) => startPinDrag(booth, event)}
                    onClick={(event) => {
                      event.stopPropagation();
                      // 끌어서 옮긴 직후의 click은 선택이 아니다.
                      if (pinDraggedRef.current) {
                        pinDraggedRef.current = false;
                        return;
                      }
                      setSelectedZoneId(zoneIdByBoothId.get(booth.id) ?? null);
                      setCheckedIds(new Set([booth.id]));
                      setEditingBoothId(booth.id);
                    }}
                    className={cn(
                      "relative flex size-3 touch-none items-center justify-center",
                      editingLocked || drawTool === "pin"
                        ? "cursor-default"
                        : draggingPin?.id === booth.id
                          ? "cursor-grabbing"
                          : "cursor-grab",
                    )}
                  >
                    {isSelected ? (
                      <span className="absolute size-3 rounded-full bg-point-600/25" />
                    ) : null}
                    <span
                      className={`relative rounded-full ${
                        isSelected ? "size-1 bg-point-600" : "size-3 bg-point-600 shadow-sm"
                      }`}
                    />
                  </button>
                </CustomOverlayMap>
              );
            })}
            {selectedBooth && !editingLocked ? (
              <CustomOverlayMap
                position={pinPositionOf(selectedBooth)}
                {...POPOVER_ANCHORS}
                zIndex={30}
              >
                <MapInfoPopover
                  mode="booth-edit"
                  style={{ position: "static" }}
                  initialName={selectedBooth.name}
                  typeLabel={NODE_TYPE_LABEL[selectedBooth.nodeType] ?? "시설"}
                  parentZoneName={selectedBoothZone?.name ?? ""}
                  confirmLabel={selectedBooth.isNew ? "등록" : "수정"}
                  hideCancel
                  onChangeType={(type) =>
                    toast.info(
                      `"${type === "pin" ? "핀" : type === "polygon" ? "폴리곤" : "라인"}"으로 유형 변경은 아직 연결되지 않았습니다`,
                    )
                  }
                  onChangeNodeType={(nodeType) =>
                    setBooths((prev) =>
                      prev.map((booth) =>
                        booth.id === selectedBooth.id ? { ...booth, nodeType } : booth,
                      ),
                    )
                  }
                  onConfirm={(name) => {
                    setBooths((prev) =>
                      prev.map((booth) =>
                        booth.id === selectedBooth.id ? { ...booth, name, isNew: false } : booth,
                      ),
                    );
                    setCheckedIds(new Set());
                    setEditingBoothId(null);
                    setSelectedZoneId(null);
                  }}
                  onCancel={() => {
                    setCheckedIds(new Set());
                    setEditingBoothId(null);
                    setSelectedZoneId(null);
                  }}
                  onDelete={() => {
                    if (selectedBooth.nodeId) {
                      setDeletedNodeIds((prev) => [...prev, selectedBooth.nodeId!]);
                    }
                    setBooths((prev) => prev.filter((booth) => booth.id !== selectedBooth.id));
                    setZones((prev) =>
                      prev
                        .map((zone) => ({
                          ...zone,
                          boothIds: zone.boothIds.filter((id) => id !== selectedBooth.id),
                        }))
                        .filter((zone) => zone.boothIds.length > 0),
                    );
                    setCheckedIds(new Set());
                    setEditingBoothId(null);
                    setSelectedZoneId(null);
                  }}
                />
              </CustomOverlayMap>
            ) : null}
            {selectedShape && !editingLocked ? (
              <CustomOverlayMap
                position={shapeAnchor(selectedShape)}
                {...POPOVER_ANCHORS}
                zIndex={30}
              >
                <MapInfoPopover
                  mode="booth-edit"
                  style={{ position: "static" }}
                  initialName={selectedShape.name}
                  typeLabel={SHAPE_LABEL[selectedShape.kind]}
                  confirmLabel={selectedShape.isNew ? "등록" : "수정"}
                  hideCancel
                  onConfirm={(name) => {
                    setShapes((prev) =>
                      prev.map((shape) =>
                        shape.id === selectedShape.id ? { ...shape, name, isNew: false } : shape,
                      ),
                    );
                    setSelectedShapeId(null);
                  }}
                  onCancel={() => setSelectedShapeId(null)}
                  onDelete={() => deleteShape(selectedShape.id)}
                />
              </CustomOverlayMap>
            ) : null}
            {groupPopoverOpen
              ? (() => {
                  if (pendingGroupMembers.length < 2) return null;
                  return (
                    <CustomOverlayMap
                      position={centroidOf(pendingGroupMembers)}
                      {...POPOVER_ANCHORS}
                      zIndex={30}
                    >
                      <MapInfoPopover
                        mode="group-create"
                        style={{ position: "static" }}
                        initialName="새 구역"
                        confirmLabel="등록"
                        hideCancel
                        onConfirm={(name) => {
                          const zone: LocalZone = {
                            id: createZoneId(),
                            name,
                            // 부스가 아닌 노드가 섞이면 저장이 통째로 거부된다.
                            boothIds: booths
                              .filter(
                                (booth) => checkedIds.has(booth.id) && booth.nodeType === "BOOTH",
                              )
                              .map((booth) => booth.id),
                          };
                          setZones((prev) => [...prev, zone]);
                          setExpandedZoneIds((prev) => new Set(prev).add(zone.id));
                          setSelectedZoneId(zone.id);
                          setCheckedIds(new Set());
                          setGroupPopoverOpen(false);
                        }}
                        onCancel={() => setGroupPopoverOpen(false)}
                        onDelete={() => setGroupPopoverOpen(false)}
                        onChangeType={(type) =>
                          toast.info(
                            `"${type === "pin" ? "핀" : type === "polygon" ? "폴리곤" : "라인"}"으로 유형 변경은 아직 연결되지 않았습니다`,
                          )
                        }
                      />
                    </CustomOverlayMap>
                  );
                })()
              : null}
            {selectedZone &&
            !selectedBooth &&
            !editingLocked &&
            checkedIds.size === 0 &&
            selectedZoneMembers.length > 0 ? (
              <CustomOverlayMap
                position={centroidOf(selectedZoneMembers)}
                {...POPOVER_ANCHORS}
                zIndex={30}
              >
                <MapInfoPopover
                  mode="zone-edit"
                  style={{ position: "static" }}
                  initialName={selectedZone.name}
                  confirmLabel="수정"
                  hideCancel
                  onChangeType={(type) =>
                    toast.info(
                      `"${type === "pin" ? "핀" : type === "polygon" ? "폴리곤" : "라인"}"으로 유형 변경은 아직 연결되지 않았습니다`,
                      { description: "화면 레이아웃만 우선 구현된 상태입니다." },
                    )
                  }
                  onConfirm={(name) => {
                    setZones((prev) =>
                      prev.map((zone) => (zone.id === selectedZone.id ? { ...zone, name } : zone)),
                    );
                    setSelectedZoneId(null);
                  }}
                  onCancel={() => setSelectedZoneId(null)}
                  onDelete={() => {
                    setZones((prev) => prev.filter((zone) => zone.id !== selectedZone.id));
                    setSelectedZoneId(null);
                  }}
                />
              </CustomOverlayMap>
            ) : null}
          </KakaoMap>
        </div>
      )}

      <MapAnalysisProgressCard
        analysis={analysis}
        className="absolute top-28 left-1/2 z-20 -translate-x-1/2 lg:top-10"
      />

      <Button
        variant="outline"
        className="absolute top-28 left-4 lg:hidden"
        aria-expanded={boothListOpen}
        onClick={() => setBoothListOpen((open) => !open)}
      >
        {boothListOpen ? "부스 목록 닫기" : "부스 목록"}
      </Button>
      <div
        className={cn(
          "absolute top-44 bottom-4 left-4 w-[calc(100%-80px)] lg:top-10 lg:bottom-10 lg:left-8 lg:block lg:w-72",
          !boothListOpen && "hidden",
        )}
      >
        <MapSidePanel className="h-full w-full">
          <p className="body-large-bold text-zinc-950">
            축제부스 <span className="text-primary">{booths.length}</span>
            {reviewRequiredCount > 0 ? (
              <span className="body-small ml-2 text-secondary-600">
                검수 필요 {reviewRequiredCount}
              </span>
            ) : null}
          </p>
          <div className="flex flex-col gap-2 rounded-md bg-zinc-100 px-4 py-3 text-left">
            <p className="body-small-bold text-zinc-950">
              {isCompleted
                ? "종료된 축제입니다."
                : analyzing
                  ? "AI가 배치도를 읽고 있습니다."
                  : booths.length === 0
                    ? "아직 찍은 부스가 없습니다."
                    : reviewRequiredCount > 0
                      ? "AI가 찾은 부스를 확인해 주세요."
                      : "지도에서 부스를 편집하세요."}
            </p>
            <p className="body-caption text-zinc-950">
              {isCompleted
                ? "결과리포트가 이 배치를 근거로 삼기 때문에 부스맵은 더 이상 수정할 수 없습니다. 지난 축제의 배치는 그대로 확인할 수 있습니다."
                : analyzing
                  ? "분석이 끝나면 찾은 부스가 지도에 표시됩니다. 그때까지 편집과 저장은 막힙니다."
                  : booths.length === 0
                    ? "오른쪽 핀 도구를 켜 지도를 클릭하거나, 배치도 이미지를 올려 AI 분석을 돌리세요."
                    : reviewRequiredCount > 0
                      ? "주황색 핀은 AI가 찾은 위치라 정확하지 않을 수 있습니다. 끌어서 옮기고 이름을 확인해 주세요."
                      : "핀을 선택해 이름을 바꾸고, 여러 개를 골라 구역으로 묶을 수 있습니다."}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            {zones.map((zone) => {
              const members = booths.filter((booth) => zone.boothIds.includes(booth.id));
              const expanded = expandedZoneIds.has(zone.id);
              return (
                <ZoneListItem
                  key={zone.id}
                  name={zone.name}
                  count={members.length}
                  expanded={expanded}
                  checked={selectedZoneId === zone.id}
                  selected={selectedZoneId === zone.id}
                  onToggleExpanded={() => toggleZoneExpanded(zone.id)}
                  onCheckedChange={(checked) =>
                    checked ? selectZone(zone.id) : setSelectedZoneId(null)
                  }
                  onSelect={() => selectZone(zone.id)}
                >
                  {members.map((booth) => renderBoothRow(booth, { indent: true }))}
                </ZoneListItem>
              );
            })}
            {ungroupedBooths.map((booth) => renderBoothRow(booth, { indent: false }))}
          </div>

          {/* 직접 그린 폴리곤·라인 — 부스 핀과 성격이 달라 구역 목록과 분리해 보여 준다. */}
          {shapes.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3">
              <p className="body-small-bold text-zinc-950">
                도형 <span className="text-primary">{shapes.length}</span>
              </p>
              {shapes.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => {
                    setEditingBoothId(null);
                    setSelectedShapeId(shape.id);
                    const anchor = shapeAnchor(shape);
                    kakaoMapRef.current?.panTo(
                      new window.kakao.maps.LatLng(anchor.lat, anchor.lng),
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1 py-2 text-left hover:bg-zinc-100",
                    selectedShapeId === shape.id && "bg-zinc-100",
                  )}
                >
                  <span className="size-4 shrink-0 text-primary [&_svg]:size-4">
                    {shape.kind === "polygon" ? <DimensionsIcon /> : <RulerHorizontalIcon />}
                  </span>
                  <span className="body-small truncate text-zinc-950">{shape.name}</span>
                  <span className="body-caption ml-auto shrink-0 text-zinc-500">
                    {SHAPE_LABEL[shape.kind]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {checkedIds.size >= 2 ? (
            <Button
              type="button"
              variant="primary"
              className="mt-auto w-full"
              onClick={() => setGroupPopoverOpen(true)}
            >
              그룹화
            </Button>
          ) : null}
        </MapSidePanel>
      </div>

      <div className="absolute top-4 right-4 left-4 flex flex-wrap items-center justify-end gap-2 lg:top-10 lg:right-8 lg:left-auto lg:gap-4">
        <div className="flex items-center gap-2">
          <span
            title={
              editLockReason ??
              (canUndo ? "실행취소 (Ctrl/⌘+Z)" : "편집 내용이 없어 실행취소할 수 없습니다.")
            }
          >
            <IconButton
              icon={<ResetIcon className="size-5" />}
              aria-label="실행취소"
              disabled={undoDisabled}
              onClick={undo}
              className={undoDisabled ? "text-zinc-500" : "text-zinc-950"}
            />
          </span>
          <span
            title={
              editLockReason ??
              (canRedo ? "다시실행 (Shift+Ctrl/⌘+Z)" : "편집 내용이 없어 다시실행할 수 없습니다.")
            }
          >
            <IconButton
              icon={<ResetIcon className="size-5 -scale-x-100" />}
              aria-label="다시실행"
              disabled={redoDisabled}
              onClick={redo}
              className={redoDisabled ? "text-zinc-500" : "text-zinc-950"}
            />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={replaceFileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) replaceMutation.mutate(file);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            icon={<FileIcon />}
            disabled={replaceMutation.isPending || editingLocked}
            title={editLockReason ?? undefined}
            onClick={() => setAnalyzeDialogOpen(true)}
          >
            {replaceMutation.isPending
              ? "배치도 올리는 중..."
              : hasBlueprintImage
                ? "다른 배치도로 다시 분석"
                : "배치도 이미지로 AI 분석"}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saveMutation.isPending || editingLocked}
            title={saveLockReason}
            onClick={() => setSaveDialogOpen(true)}
          >
            {saveMutation.isPending ? "저장 중..." : "저장하기"}
          </Button>
        </div>
        <IconButton
          icon={<Cross2Icon className="size-5" />}
          aria-label="닫기"
          className="text-zinc-950"
          onClick={() => setCloseDialogOpen(true)}
        />
      </div>

      <div className="absolute right-4 bottom-4 flex flex-col items-center gap-5 lg:right-8 lg:bottom-10">
        <div className="flex flex-col gap-1">
          <IconButton
            icon={<RadiobuttonIcon className="size-5" />}
            aria-label="핀 추가"
            aria-pressed={drawTool === "pin"}
            disabled={editingLocked}
            className={cn("text-zinc-950", drawTool === "pin" && "ring-2 ring-primary")}
            onClick={() => {
              setDraftPoints([]);
              setPinTypeMenuOpen((open) => !open);
            }}
          />
          {pinTypeMenuOpen ? (
            <div className="absolute right-full bottom-20 mr-2 w-25 rounded-lg border border-zinc-200 bg-white p-2 shadow-md">
              {[
                { type: "OTHER" as const, label: "시설", icon: <RadiobuttonIcon /> },
                { type: "BOOTH" as const, label: "부스", icon: <Crosshair2Icon /> },
                { type: "ENTRANCE" as const, label: "입구", icon: <HomeIcon /> },
                { type: "EXIT" as const, label: "출구", icon: <HomeIcon /> },
                { type: "RESTROOM" as const, label: "화장실", icon: <FaceIcon /> },
              ].map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => {
                    setPendingPinType(option.type);
                    setDrawTool("pin");
                    setPinTypeMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 border-b border-zinc-200 py-2 text-left last:border-b-0 hover:bg-zinc-100"
                >
                  <span className="size-4 shrink-0 text-primary [&_svg]:size-4">{option.icon}</span>
                  <span className="body-small text-zinc-950">{option.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          <span title={editLockReason ?? "폴리곤 그리기 — 지도를 눌러 꼭짓점을 찍습니다"}>
            <IconButton
              icon={<DimensionsIcon className="size-5" />}
              aria-label="폴리곤 추가"
              aria-pressed={drawTool === "polygon"}
              disabled={editingLocked}
              className={cn("text-zinc-950", drawTool === "polygon" && "ring-2 ring-primary")}
              onClick={() => startShapeTool("polygon")}
            />
          </span>
          <span title={editLockReason ?? "라인 그리기 — 지도를 눌러 꺾은점을 찍습니다"}>
            <IconButton
              icon={<RulerHorizontalIcon className="size-5" />}
              aria-label="라인 추가"
              aria-pressed={drawTool === "line"}
              disabled={editingLocked}
              className={cn("text-zinc-950", drawTool === "line" && "ring-2 ring-primary")}
              onClick={() => startShapeTool("line")}
            />
          </span>
        </div>
        <MapZoomControls
          onZoomIn={() => setZoomStep((step) => Math.max(step - 1, -2))}
          onZoomOut={() => setZoomStep((step) => Math.min(step + 1, 4))}
        />
      </div>

      {drawTool === "polygon" || drawTool === "line" ? (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-md lg:bottom-10">
          <p className="body-small text-zinc-950">
            지도를 눌러 {SHAPE_LABEL[drawTool]} 꼭짓점을 찍으세요
            <span className="body-small-bold ml-2 text-primary">
              {draftPoints.length}개 / 최소 {SHAPE_MINIMUM_POINTS[drawTool]}개
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={draftPoints.length === 0}
            onClick={undoDraftPoint}
          >
            한 점 취소
          </Button>
          <Button type="button" variant="outline" onClick={cancelDraftShape}>
            그만두기
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={draftPoints.length < SHAPE_MINIMUM_POINTS[drawTool]}
            onClick={finishDraftShape}
          >
            그리기 완료
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title="저장하시겠습니까?"
        confirmLabel="저장"
        confirmVariant="primary"
        confirmPending={saveMutation.isPending}
        onConfirm={() => {
          setSaveDialogOpen(false);
          saveMutation.mutate();
        }}
      />
      <ConfirmDialog
        open={analyzeDialogOpen}
        onOpenChange={setAnalyzeDialogOpen}
        title="배치도 이미지로 AI 분석을 시작할까요?"
        description={
          booths.length > 0
            ? `지도를 새로 만들기 때문에 지금 찍혀 있는 핀 ${booths.length}개가 사라집니다. 저장하지 않은 편집도 함께 사라집니다.`
            : "AI가 배치도에서 부스를 찾아 핀으로 뿌려 줍니다. 분석이 끝날 때까지 편집과 저장은 막힙니다."
        }
        confirmLabel="이미지 선택"
        confirmVariant="primary"
        onConfirm={() => {
          setAnalyzeDialogOpen(false);
          replaceFileInputRef.current?.click();
        }}
      />
      <ConfirmDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        title="나가시겠습니까?"
        description="저장하지 않은 내용은 사라집니다."
        confirmLabel="나가기"
        confirmVariant="destructive"
        onConfirm={() => router.push(`/console/festivals/${festivalId}`)}
      />
    </div>
  );
}
