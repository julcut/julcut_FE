"use client";

import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useKakaoLoader } from "react-kakao-maps-sdk";
import { Bottombar } from "@/components/ui/Bottombar";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { DATE_DISPLAY_PATTERN, formatDateInput, toDisplayDate, toIsoDate } from "./dateFormat";
import { createFestival, searchFestivalSeries } from "@/features/festivals/api";
import type {
  FestivalSeriesSearchResult,
  FestivalVisitorCountInputMode,
} from "@/features/festivals/types";
import { getApiErrorMessage } from "@/lib/api/httpError";
import {
  createInitialLocationDrafts,
  createLocationDraft,
  isLocationDraftComplete,
  toFestivalLocationRequests,
  type LocationDraft,
} from "./locationDraft";
import { SearchDialog, type SearchDialogResult, type SearchDialogState } from "./SearchDialog";
import { VisitorCountModeField } from "./VisitorCountModeField";
import { canCreateFestival } from "@/features/auth/admin/types";
import { useAdminAuthStore } from "@/store/adminAuthStore";

export function FestivalRegisterForm() {
  const router = useRouter();
  const accountKind = useAdminAuthStore((state) => state.session?.admin.accountKind);
  const allowedToCreate = canCreateFestival(accountKind);

  useEffect(() => {
    if (!allowedToCreate) router.replace("/console");
  }, [allowedToCreate, router]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locations, setLocations] = useState<LocationDraft[]>(() => createInitialLocationDrafts());
  const [primaryKey, setPrimaryKey] = useState(() => locations[0].key);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 미설정(UNSET)으로 등록되면 결과 리포트를 만들 수 없어 기본값을 일자별로 둔다.
  const [visitorCountInputMode, setVisitorCountInputMode] =
    useState<FestivalVisitorCountInputMode>("DAILY");
  const [formError, setFormError] = useState<string | null>(null);

  const [festivalSearchOpen, setFestivalSearchOpen] = useState(false);
  const [festivalSearchState, setFestivalSearchState] = useState<SearchDialogState>("default");
  const [festivalSearchResults, setFestivalSearchResults] = useState<FestivalSeriesSearchResult[]>(
    [],
  );
  const [festivalSearchPending, setFestivalSearchPending] = useState(false);
  const [addressSearchTargetKey, setAddressSearchTargetKey] = useState<string | null>(null);
  const [addressSearchState, setAddressSearchState] = useState<SearchDialogState>("default");
  const [addressSearchResults, setAddressSearchResults] = useState<SearchDialogResult[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "",
    libraries: ["services"],
  });

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
    setLocations((current) => {
      const [first, ...rest] = current;
      return [
        {
          ...first,
          roadAddress: series.latestAddress,
          detailAddress: series.latestDetailAddress,
        },
        ...rest,
      ];
    });
    setStartDate(toDisplayDate(series.latestStartDate));
    setEndDate(toDisplayDate(series.latestEndDate));
    setFestivalSearchOpen(false);
  }

  function searchAddress(keyword: string) {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(keyword, (data, status) => {
      if (status !== kakao.maps.services.Status.OK || data.length === 0) {
        setAddressSearchResults([]);
        setAddressSearchState("none");
        return;
      }
      setAddressSearchResults(
        data.map((item, index) => ({
          id: `${item.address_name}-${index}`,
          label: item.road_address?.address_name ?? item.address_name,
          description: item.address_name,
          latitude: Number(item.y),
          longitude: Number(item.x),
        })),
      );
      setAddressSearchState("result");
    });
  }

  function updateLocation(key: string, patch: Partial<Omit<LocationDraft, "key">>) {
    setLocations((current) => current.map((loc) => (loc.key === key ? { ...loc, ...patch } : loc)));
  }

  function addLocation() {
    setLocations((current) => [
      ...current,
      createLocationDraft("SUB_VENUE", `장소 ${current.length + 1}`),
    ]);
  }

  function removeLocation(key: string) {
    setLocations((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((loc) => loc.key !== key);
      if (primaryKey === key) setPrimaryKey(next[0].key);
      return next;
    });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const request = {
        name,
        description,
        locations: toFestivalLocationRequests(locations, primaryKey),
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        // 운영 시작/종료 시간은 이번 화면 디자인에 없어 임시 기본값을 보낸다.
        // 디자인에 운영시간 입력이 추가되면 이 기본값을 실제 입력값으로 교체해야 한다.
        operationStartTime: "09:00:00",
        operationEndTime: "18:00:00",
        visitorCountInputMode,
      };

      const festival = await createFestival(request);
      return festival;
    },
    onSuccess: (festival) => {
      // 등록 직후 부스맵으로 넘어가므로, 이동한 화면에서 결과를 알 수 있게 토스트를 남긴다.
      toast.success("축제를 등록했습니다.", {
        description: "이어서 부스 위치를 찍어 주세요.",
      });
      router.push(`/console/festivals/${festival.festivalId}/boothmap`);
    },
  });

  function handleSubmitClick() {
    if (name.trim().length === 0) {
      setFormError("축제명을 입력해 주세요.");
      return;
    }
    if (description.trim().length === 0) {
      setFormError("축제 설명을 입력해 주세요.");
      return;
    }
    if (!DATE_DISPLAY_PATTERN.test(startDate) || !DATE_DISPLAY_PATTERN.test(endDate)) {
      setFormError("날짜는 YYYY.mm.dd 형식으로 입력해 주세요.");
      return;
    }
    if (toIsoDate(startDate) > toIsoDate(endDate)) {
      setFormError("종료날짜는 시작날짜보다 빠를 수 없습니다.");
      return;
    }
    if (locations.some((location) => !isLocationDraftComplete(location))) {
      setFormError("모든 장소에 이름과 주소를 입력해 주세요.");
      return;
    }
    setFormError(null);
    setSubmitDialogOpen(true);
  }

  const addressSearchTarget = locations.find((loc) => loc.key === addressSearchTargetKey) ?? null;

  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-6 pb-24">
      <FormSection label="축제 기본정보 입력">
        <Input
          layout="with-button"
          placeholder="축제명을 입력해 주세요"
          value={name}
          onChange={(event) => setName(event.target.value)}
          button={
            <Button type="button" onClick={() => setFestivalSearchOpen(true)}>
              축제 검색하기
            </Button>
          }
        />
        <Textarea
          placeholder="축제 설명을 작성해 주세요"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormSection>

      <FormSection label="축제 상세정보 입력">
        <div className="flex flex-col gap-4">
          {locations.map((location, index) => (
            <div key={location.key} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                {index > 0 ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="body-small-bold text-zinc-950">장소 {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<TrashIcon />}
                      className="py-0"
                      onClick={() => removeLocation(location.key)}
                    >
                      삭제
                    </Button>
                  </div>
                ) : null}

                {location.roadAddress ? (
                  <Input
                    disabled
                    value={location.roadAddress}
                    className="disabled:border-zinc-400!"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddressSearchTargetKey(location.key);
                      setAddressSearchState("default");
                    }}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 body-regular text-zinc-950 transition-colors hover:bg-zinc-50"
                  >
                    <MagnifyingGlassIcon className="size-4" />
                    주소 찾기
                  </button>
                )}
              </div>
              <Input
                placeholder="상세주소"
                value={location.detailAddress}
                onChange={(event) =>
                  updateLocation(location.key, { detailAddress: event.target.value })
                }
              />
              {index === 0 ? (
                <div className="flex gap-3">
                  <Input
                    label="시작날짜"
                    wrapperClassName="flex-1"
                    placeholder="YYYY.mm.dd"
                    inputMode="numeric"
                    maxLength={10}
                    value={startDate}
                    onChange={(event) => setStartDate(formatDateInput(event.target.value))}
                  />
                  <Input
                    label="종료날짜"
                    wrapperClassName="flex-1"
                    placeholder="YYYY.mm.dd"
                    inputMode="numeric"
                    maxLength={10}
                    value={endDate}
                    onChange={(event) => setEndDate(formatDateInput(event.target.value))}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          icon={<PlusIcon />}
          className="mt-3"
          onClick={addLocation}
        >
          장소 추가
        </Button>
        {formError ? <p className="body-caption text-error">{formError}</p> : null}
      </FormSection>

      <FormSection label="방문 인원 집계 방식">
        <VisitorCountModeField value={visitorCountInputMode} onChange={setVisitorCountInputMode} />
      </FormSection>

      {createMutation.isError ? (
        <p className="body-small text-error">{getApiErrorMessage(createMutation.error)}</p>
      ) : null}

      <Bottombar onCancel={() => setCancelDialogOpen(true)} onSubmit={handleSubmitClick} />

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

      <SearchDialog
        open={addressSearchTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAddressSearchTargetKey(null);
            setAddressSearchState("default");
          }
        }}
        title="주소 찾기"
        placeholder="주소를 입력하세요"
        helperText="도로명, 건물명, 또는 지번 중 편한 방법으로 검색하세요."
        helperItems={[
          "도로명 + 건물번호(예: 세계로 10)",
          "지역명(동/리) + 번지(예: 반곡동 1914-6)",
          "지역명(동/리) + 건물명(예: 한국관광공사)",
        ]}
        state={addressSearchState}
        results={addressSearchResults}
        onSearch={searchAddress}
        noResultSubtext="하단의 직접 입력을 눌러 주소를 등록해 주세요"
        onSelectResult={(result) => {
          if (addressSearchTargetKey)
            updateLocation(addressSearchTargetKey, {
              roadAddress: result.label,
              latitude: result.latitude,
              longitude: result.longitude,
            });
          setAddressSearchTargetKey(null);
        }}
        onManualInput={(value) => {
          if (addressSearchTargetKey)
            updateLocation(addressSearchTargetKey, { roadAddress: value });
          setAddressSearchTargetKey(null);
        }}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="등록을 취소하시겠습니까?"
        description="작성된 정보는 저장되지 않습니다."
        cancelLabel="취소"
        confirmLabel="확인"
        onConfirm={() => router.back()}
      />

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="축제를 등록하시겠습니까?"
        cancelLabel="취소"
        confirmLabel="등록"
        confirmVariant="primary"
        confirmPending={createMutation.isPending}
        onConfirm={() => createMutation.mutate()}
      />
    </div>
  );
}
