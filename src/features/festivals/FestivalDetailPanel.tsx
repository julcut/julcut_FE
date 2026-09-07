"use client";

import { Pencil1Icon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomOverlayMap, Map } from "react-kakao-maps-sdk";
import { toast } from "sonner";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import { Bottombar } from "@/components/ui/Bottombar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { primaryFestivalCenter } from "@/features/boothmap/mapCenter";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { deleteFestival, getManagedFestival, searchFestivalSeries, updateFestival } from "./api";
import { DATE_DISPLAY_PATTERN, formatDateInput, toDisplayDate, toIsoDate } from "./dateFormat";
import { SearchDialog, type SearchDialogState } from "./SearchDialog";
import type {
  FestivalLocationRequest,
  FestivalLocationResponse,
  FestivalSeriesSearchResult,
  FestivalVisitorCountInputMode,
} from "./types";
import { VisitorCountModeField } from "./VisitorCountModeField";

export function FestivalDetailPanel({ festivalId }: { festivalId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [detailAddress, setDetailAddress] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [visitorCountInputMode, setVisitorCountInputMode] =
    useState<FestivalVisitorCountInputMode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [festivalSearchOpen, setFestivalSearchOpen] = useState(false);
  const [festivalSearchState, setFestivalSearchState] = useState<SearchDialogState>("default");
  const [festivalSearchResults, setFestivalSearchResults] = useState<FestivalSeriesSearchResult[]>(
    [],
  );
  const [festivalSearchPending, setFestivalSearchPending] = useState(false);

  const festivalQuery = useQuery({
    queryKey: ["managed-festival", festivalId],
    queryFn: () => getManagedFestival(festivalId),
  });
  const festival = festivalQuery.data;

  async function searchFestivals(keyword: string) {
    setFestivalSearchPending(true);
    try {
      const results = await searchFestivalSeries(keyword);
      setFestivalSearchResults(results);
      setFestivalSearchState(results.length > 0 ? "result" : "none");
    } finally {
      setFestivalSearchPending(false);
    }
  }

  function applyFestivalSeries(series: FestivalSeriesSearchResult) {
    setName(series.name);
    setDescription(series.latestDescription);
    setDetailAddress(series.latestDetailAddress);
    setStartDate(toDisplayDate(series.latestStartDate));
    setEndDate(toDisplayDate(series.latestEndDate));
    setFestivalSearchOpen(false);
  }
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!festival) return Promise.resolve();
      const locations: FestivalLocationRequest[] = festival.locations.map((location) => ({
        ...location,
        detailAddress: location.primary
          ? (detailAddress ?? festival.detailAddress ?? undefined)
          : (location.detailAddress ?? undefined),
        roadAddress: location.roadAddress ?? undefined,
        jibunAddress: location.jibunAddress ?? undefined,
        postalCode: location.postalCode ?? undefined,
        buildingManagementNumber: location.buildingManagementNumber ?? undefined,
        latitude: location.latitude ?? undefined,
        longitude: location.longitude ?? undefined,
        boundaryGeometry: location.boundaryGeometry ?? undefined,
      }));
      const selectedVisitorCountInputMode =
        visitorCountInputMode ??
        (festival.visitorCountInputMode === "UNSET" ? undefined : festival.visitorCountInputMode);
      return updateFestival(festivalId, {
        name: name ?? festival.festivalName ?? "",
        description: description ?? festival.description ?? "",
        locations,
        startDate: toIsoDate(startDate ?? toDisplayDate(festival.startDate ?? "")),
        endDate: toIsoDate(endDate ?? toDisplayDate(festival.endDate ?? "")),
        visitorCountInputMode: selectedVisitorCountInputMode,
      });
    },
    onSuccess: () => {
      setEditDialogOpen(false);
      setName(null);
      setDescription(null);
      setDetailAddress(null);
      setStartDate(null);
      setEndDate(null);
      setVisitorCountInputMode(null);
      queryClient.invalidateQueries({ queryKey: ["managed-festival", festivalId] });
      queryClient.invalidateQueries({ queryKey: ["managed-festivals"] });
      toast.success("축제 정보를 수정했습니다.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "축제 수정에 실패했습니다.")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFestival(festivalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-festivals"] });
      // 삭제 후 화면을 떠나므로 이동한 자리에서 결과를 알 수 있게 토스트를 남긴다.
      toast.success("축제를 삭제했습니다.");
      router.push("/console");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "축제 삭제에 실패했습니다.")),
  });

  if (festivalQuery.isLoading) return <p className="body-regular text-zinc-500">불러오는 중...</p>;
  if (festivalQuery.isError) {
    return <p className="body-small text-error">{getApiErrorMessage(festivalQuery.error)}</p>;
  }
  if (!festival) return null;

  const displayStartDate = startDate ?? toDisplayDate(festival.startDate ?? "");
  const displayEndDate = endDate ?? toDisplayDate(festival.endDate ?? "");
  const displayVisitorCountInputMode =
    visitorCountInputMode ??
    (festival.visitorCountInputMode === "UNSET" ? null : festival.visitorCountInputMode);

  function handleEditClick() {
    const updatedName = (name ?? festival?.festivalName ?? "").trim();
    const updatedDescription = (description ?? festival?.description ?? "").trim();
    if (updatedName.length < 2 || updatedName.length > 100) {
      setFormError("축제명은 2~100자로 입력해 주세요.");
      return;
    }
    if (!updatedDescription || updatedDescription.length > 1000) {
      setFormError("축제 내용은 1~1000자로 입력해 주세요.");
      return;
    }
    if (
      !DATE_DISPLAY_PATTERN.test(displayStartDate) ||
      !DATE_DISPLAY_PATTERN.test(displayEndDate)
    ) {
      setFormError("날짜는 YYYY.mm.dd 형식으로 입력해 주세요.");
      return;
    }
    if (toIsoDate(displayStartDate) > toIsoDate(displayEndDate)) {
      setFormError("종료날짜는 시작날짜보다 빠를 수 없습니다.");
      return;
    }
    if (!displayVisitorCountInputMode) {
      setFormError("방문 인원 집계 방식을 선택해 주세요.");
      return;
    }
    setFormError(null);
    setEditDialogOpen(true);
  }

  return (
    <div className="col-span-3 flex min-w-0 flex-col gap-6 pb-24">
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="col-span-1 flex min-w-0 flex-col gap-4 rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8">
          <p className="body-large-bold text-zinc-950">축제 정보</p>

          <Input
            label="축제명"
            layout="with-button"
            value={name ?? festival.festivalName ?? ""}
            onChange={(event) => setName(event.target.value)}
            button={
              <Button type="button" onClick={() => setFestivalSearchOpen(true)}>
                축제 검색
              </Button>
            }
          />

          <div className="flex w-full flex-col gap-1">
            <label className="body-small-bold text-zinc-950">내용</label>
            <Textarea
              rows={3}
              value={description ?? festival.description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex w-full flex-col gap-1">
            <label className="body-small-bold text-zinc-950">장소</label>
            <div className="flex flex-col gap-2">
              <Input disabled value={festival.address ?? ""} />
              <Input
                value={detailAddress ?? festival.detailAddress ?? ""}
                onChange={(event) => setDetailAddress(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Input
              label="시작날짜"
              wrapperClassName="flex-1"
              placeholder="YYYY.mm.dd"
              inputMode="numeric"
              maxLength={10}
              value={displayStartDate}
              onChange={(event) => setStartDate(formatDateInput(event.target.value))}
            />
            <Input
              label="종료날짜"
              wrapperClassName="flex-1"
              placeholder="YYYY.mm.dd"
              inputMode="numeric"
              maxLength={10}
              value={displayEndDate}
              onChange={(event) => setEndDate(formatDateInput(event.target.value))}
            />
          </div>

          <VisitorCountModeField
            label="방문 인원 집계 방식"
            value={displayVisitorCountInputMode}
            onChange={setVisitorCountInputMode}
          />

          {formError ? <p className="body-caption text-error">{formError}</p> : null}
        </div>

        <div className="relative min-h-[360px] xl:col-span-2 xl:min-h-[calc(100vh-252px)] overflow-hidden rounded-lg bg-zinc-100">
          <FestivalLocationMap locations={festival?.locations} />
          <Button
            type="button"
            variant="primary"
            icon={<Pencil1Icon />}
            className="absolute top-4 right-4 z-10 shadow-md"
            onClick={() => router.push(`/console/festivals/${festivalId}/boothmap`)}
          >
            부스지도 수정
          </Button>
        </div>
      </div>

      <Bottombar
        cancelLabel="삭제하기"
        onCancel={() => setDeleteDialogOpen(true)}
        submitLabel="수정하기"
        onSubmit={handleEditClick}
      />

      <SearchDialog
        open={festivalSearchOpen}
        onOpenChange={(next) => {
          setFestivalSearchOpen(next);
          if (!next) setFestivalSearchState("default");
        }}
        title="축제 검색"
        placeholder="축제명을 입력해 주세요"
        helperText="축제명으로 검색하면 이전 축제 정보를 불러올 수 있어요."
        helperItems={["이미 API에 등록된 축제면 이전 말고 현재 축제 정보를 불러오는지"]}
        state={festivalSearchState}
        results={festivalSearchResults.map((series) => ({
          id: series.seriesId,
          label: series.name,
          description: series.latestAddress,
        }))}
        searchPending={festivalSearchPending}
        onSearch={searchFestivals}
        noResultSubtext="하단의 직접 입력을 눌러 축제명을 등록해 주세요"
        onSelectResult={(result) => {
          const series = festivalSearchResults.find((item) => item.seriesId === result.id);
          if (series) applyFestivalSeries(series);
        }}
        onManualInput={(value) => {
          setName(value);
          setFestivalSearchOpen(false);
        }}
      />

      <ConfirmDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="축제를 수정하시겠습니까?"
        description={updateMutation.isError ? getApiErrorMessage(updateMutation.error) : undefined}
        confirmLabel="수정"
        confirmVariant="primary"
        confirmPending={updateMutation.isPending}
        onConfirm={() => updateMutation.mutate()}
      />
      {updateMutation.isError ? (
        <p className="body-small text-error">{getApiErrorMessage(updateMutation.error)}</p>
      ) : null}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="축제를 삭제하시겠습니까?"
        description="삭제는 영구적입니다. 데이터를 복구할 수 없습니다."
        confirmLabel="확인"
        confirmPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
      {deleteMutation.isError ? (
        <p className="body-small text-error">{getApiErrorMessage(deleteMutation.error)}</p>
      ) : null}
    </div>
  );
}

function FestivalLocationMap({ locations }: { locations: FestivalLocationResponse[] | undefined }) {
  const [loading, error] = useKakaoMapLoader();
  const center = useMemo(() => primaryFestivalCenter(locations), [locations]);

  if (!center) {
    return (
      <div className="flex h-full min-h-[360px] xl:min-h-[calc(100vh-252px)] items-center justify-center px-6">
        <p className="body-small text-zinc-500">등록된 축제 위치 좌표가 없습니다.</p>
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || error || loading) {
    return (
      <div className="flex h-full min-h-[360px] xl:min-h-[calc(100vh-252px)] items-center justify-center">
        <p className="body-small text-zinc-500">
          {!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
            ? "NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았습니다."
            : error
              ? "카카오맵을 불러오지 못했습니다."
              : "지도를 불러오는 중..."}
        </p>
      </div>
    );
  }

  return (
    <Map center={center} isPanto={false} level={2} className="absolute inset-0">
      <CustomOverlayMap position={center}>
        <span aria-label="축제 위치" className="block size-3 rounded-full bg-point-600 shadow-sm" />
      </CustomOverlayMap>
    </Map>
  );
}
