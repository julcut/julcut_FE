"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomOverlayMap, Map as KakaoMap, Polygon } from "react-kakao-maps-sdk";
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
  type LocalBoothPin,
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
  const [drawTool, setDrawTool] = useState<"select" | "pin">("select");
  const [pendingPinType, setPendingPinType] = useState<NodeType>("BOOTH");
  const [pinTypeMenuOpen, setPinTypeMenuOpen] = useState(false);
  const [mapLoading, mapError] = useKakaoMapLoader();
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const kakaoMapRef = useRef<kakao.maps.Map | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
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
  const mapCenter = editorQuery.data?.center ?? mapQuery.data?.center ?? festivalCenter;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!mapQuery.data?.mapId) {
        throw new Error("지도 정보를 불러오지 못했습니다.");
      }
      // 부스를 전부 지운 경우에도 삭제 내역은 서버에 보내야 하므로, 지울 노드가 있으면 통과시킨다.
      if (booths.length === 0 && deletedNodeIds.length === 0) {
        throw new Error("저장할 부스가 없습니다.");
      }
      return saveMapEditor(festivalId, mapQuery.data.mapId, {
        baseRevision: editRevision,
        nodes: boothMapPinsToNodeChanges(booths, deletedNodeIds),
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
  const editingLocked = analysis.isRunning || editorQuery.data?.roadmapStatus === "ANALYZING";
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
    () => JSON.stringify({ booths, zones, deletedNodeIds }),
    [booths, zones, deletedNodeIds],
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
      zones: LocalZone[];
      deletedNodeIds: string[];
    };
    setBooths(restored.booths);
    setZones(restored.zones);
    setDeletedNodeIds(restored.deletedNodeIds);
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
            disabled={booth.nodeType !== "BOOTH"}
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
          onMouseDown={() => setDraggableRowId(booth.id)}
          onMouseUp={() => setDraggableRowId(null)}
          className="shrink-0 cursor-grab touch-none text-zinc-400 active:cursor-grabbing"
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
          className={cn("absolute inset-0 isolate", drawTool === "pin" && "cursor-crosshair")}
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
              if (drawTool !== "pin" || editingLocked) return;
              const latLng = mouseEvent.latLng;
              if (!latLng) return;
              addBoothAt(latLng.getLat(), latLng.getLng());
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
            {visibleBooths.map((booth) => {
              const isSelected = booth.id === selectedId;
              return (
                <CustomOverlayMap
                  key={booth.id}
                  position={{ lat: booth.lat, lng: booth.lng }}
                  clickable
                  zIndex={isSelected ? 20 : 10}
                >
                  <button
                    type="button"
                    title={booth.name}
                    aria-label={booth.name}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedZoneId(zoneIdByBoothId.get(booth.id) ?? null);
                      setCheckedIds(new Set([booth.id]));
                      setEditingBoothId(booth.id);
                    }}
                    className="relative flex size-3 items-center justify-center"
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
            {selectedBooth ? (
              <CustomOverlayMap
                position={{ lat: selectedBooth.lat, lng: selectedBooth.lng }}
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
              {editingLocked
                ? "AI가 배치도를 읽고 있습니다."
                : booths.length === 0
                  ? "아직 찍은 부스가 없습니다."
                  : reviewRequiredCount > 0
                    ? "AI가 찾은 부스를 확인해 주세요."
                    : "지도에서 부스를 편집하세요."}
            </p>
            <p className="body-caption text-zinc-950">
              {editingLocked
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
              editingLocked
                ? "AI 분석이 끝난 뒤에 편집할 수 있습니다."
                : canUndo
                  ? "실행취소 (Ctrl/⌘+Z)"
                  : "편집 내용이 없어 실행취소할 수 없습니다."
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
              editingLocked
                ? "AI 분석이 끝난 뒤에 편집할 수 있습니다."
                : canRedo
                  ? "다시실행 (Shift+Ctrl/⌘+Z)"
                  : "편집 내용이 없어 다시실행할 수 없습니다."
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
            title={editingLocked ? "AI 분석이 끝난 뒤에 저장할 수 있습니다." : undefined}
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
            onClick={() => setPinTypeMenuOpen((open) => !open)}
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
          <span title="1차는 핀만 지원합니다.">
            <IconButton
              icon={<DimensionsIcon className="size-5" />}
              aria-label="폴리곤 추가"
              disabled
              className="text-zinc-950"
            />
          </span>
          <span title="1차는 핀만 지원합니다.">
            <IconButton
              icon={<RulerHorizontalIcon className="size-5" />}
              aria-label="라인 추가"
              disabled
              className="text-zinc-950"
            />
          </span>
        </div>
        <MapZoomControls
          onZoomIn={() => setZoomStep((step) => Math.max(step - 1, -2))}
          onZoomOut={() => setZoomStep((step) => Math.min(step + 1, 4))}
        />
      </div>

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
