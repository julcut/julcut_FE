"use client";

import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AttachmentField } from "@/components/ui/AttachmentField";
import { Bottombar } from "@/components/ui/Bottombar";
import { toast } from "sonner";
import { useKakaoMapLoader } from "@/lib/kakaoMapLoader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormSection } from "@/components/ui/FormSection";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { DATE_DISPLAY_PATTERN, formatDateInput, toDisplayDate, toIsoDate } from "./dateFormat";
import {
  createFestival,
  createFestivalWithMap,
  searchFestivalSeries,
} from "@/features/festivals/api";
import type {
  FestivalSeriesSearchResult,
  FestivalVisitorCountInputMode,
} from "@/features/festivals/types";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { geocodeAddress } from "@/lib/kakaoGeocoder";
import {
  createInitialLocationDrafts,
  createLocationDraft,
  hasLocationDraftCoordinate,
  isLocationDraftComplete,
  toFestivalLocationRequests,
  type LocationDraft,
} from "./locationDraft";
import { SearchDialog, type SearchDialogResult, type SearchDialogState } from "./SearchDialog";
import { canCreateFestival } from "@/features/auth/admin/types";
import { useAdminAuthStore } from "@/store/adminAuthStore";

/** 서버(MapImagePreparationService)가 받는 배치도 형식. webp는 거부된다. */
const MAP_IMAGE_ACCEPT = "image/png,image/jpeg";
const MAP_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"];
/** application.yml의 app.map.image.max-file-size 기본값과 맞춘다. */
const MAP_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

/** 주소를 좌표로 바꾸지 못했을 때 공통으로 쓰는 안내. */
const ADDRESS_GEOCODE_FAILED_MESSAGE = "주소를 찾지 못했습니다. 주소 검색으로 다시 선택해 주세요.";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<File | null>(null);
  const [mapImageError, setMapImageError] = useState<string | null>(null);

  const [festivalSearchOpen, setFestivalSearchOpen] = useState(false);
  const [festivalSearchState, setFestivalSearchState] = useState<SearchDialogState>("default");
  const [festivalSearchResults, setFestivalSearchResults] = useState<FestivalSeriesSearchResult[]>(
    [],
  );
  const [festivalSearchPending, setFestivalSearchPending] = useState(false);
  const [addressSearchTargetKey, setAddressSearchTargetKey] = useState<string | null>(null);
  const [addressSearchState, setAddressSearchState] = useState<SearchDialogState>("default");
  const [addressSearchResults, setAddressSearchResults] = useState<SearchDialogResult[]>([]);
  const [addressManualPending, setAddressManualPending] = useState(false);
  const [addressManualError, setAddressManualError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [geocodePending, setGeocodePending] = useState(false);
  /** 등록 직전 지오코딩까지 해봐도 좌표를 못 구한 장소 key — 해당 주소 칸에만 사유를 띄운다. */
  const [addressErrorKeys, setAddressErrorKeys] = useState<string[]>([]);
  /*
    등록 확인 다이얼로그를 띄우기 직전에 좌표까지 채운 장소 목록. 확인 버튼이
    누르는 시점의 `locations` 상태를 다시 읽지 않고 이 값을 그대로 보내서,
    검증을 통과한 목록과 실제로 전송되는 목록이 어긋나지 않게 한다.
  */
  const [submitLocations, setSubmitLocations] = useState<LocationDraft[]>([]);

  useKakaoMapLoader();

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

  async function applyFestivalSeries(series: FestivalSeriesSearchResult) {
    setName(series.name);
    setDescription(series.latestDescription);
    setStartDate(toDisplayDate(series.latestStartDate));
    setEndDate(toDisplayDate(series.latestEndDate));
    setFestivalSearchOpen(false);

    // 시리즈 검색 결과에는 주소만 있고 좌표가 없다. 주소를 채우면서 좌표도 같이 만들어 둔다.
    const firstKey = locations[0]?.key;
    setLocations((current) => {
      const [first, ...rest] = current;
      return [
        {
          ...first,
          roadAddress: series.latestAddress,
          detailAddress: series.latestDetailAddress,
          latitude: undefined,
          longitude: undefined,
        },
        ...rest,
      ];
    });

    const coordinate = await geocodeAddress(series.latestAddress);
    // 여기서 실패해도 막지 않는다. 등록 직전 검증이 다시 시도하고, 그때도 못 찾으면 안내한다.
    if (coordinate && firstKey) updateLocation(firstKey, coordinate);
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
    // 좌표가 채워졌으면 이 장소에 걸린 "주소를 못 찾음" 표시를 걷는다.
    if (patch.latitude != null) setAddressErrorKeys((current) => current.filter((k) => k !== key));
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
    mutationFn: async (locationsToSubmit: LocationDraft[]) => {
      const request = {
        name,
        description,
        locations: toFestivalLocationRequests(locationsToSubmit, primaryKey),
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        // 운영 시작/종료 시간은 이번 화면 디자인에 없어 임시 기본값을 보낸다.
        // 디자인에 운영시간 입력이 추가되면 이 기본값을 실제 입력값으로 교체해야 한다.
        operationStartTime: "09:00:00",
        operationEndTime: "18:00:00",
        // 화면설계서에 집계 방식 입력이 없어 화면에는 노출하지 않는다. 다만 보내지 않으면
        // 축제가 UNSET으로 만들어져 결과 리포트를 영영 만들 수 없으므로 기본값을 싣는다.
        visitorCountInputMode: "DAILY" as FestivalVisitorCountInputMode,
      };

      // 배치도를 첨부했으면 multipart로 함께 올린다. 서버는 이 경로에서만 AI 분석을
      // 대기열에 넣으므로(enqueueInitial), 첨부 여부가 곧 분석 여부다.
      if (mapImage) {
        const created = await createFestivalWithMap(request, mapImage);
        return { festival: created.festival, analyzing: true };
      }
      const festival = await createFestival(request);
      return { festival, analyzing: false };
    },
    onSuccess: ({ festival, analyzing }) => {
      // 등록 직후 부스맵으로 넘어가므로, 이동한 화면에서 결과를 알 수 있게 토스트를 남긴다.
      toast.success("축제를 등록했습니다.", {
        description: analyzing
          ? "AI가 첨부한 배치도에서 부스를 찾고 있습니다."
          : "이어서 부스 위치를 찍어 주세요.",
      });
      router.push(`/console/festivals/${festival.festivalId}/boothmap`);
    },
  });

  function selectMapImage(file: File) {
    if (!MAP_IMAGE_MIME_TYPES.includes(file.type)) {
      setMapImage(null);
      setMapImageError("PNG 또는 JPG 이미지만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > MAP_IMAGE_MAX_BYTES) {
      setMapImage(null);
      setMapImageError("배치도 이미지는 50MB까지 첨부할 수 있습니다.");
      return;
    }
    setMapImage(file);
    setMapImageError(null);
  }

  async function handleSubmitClick() {
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

    /*
      좌표가 빈 장소를 주소로 지오코딩해서 채운다. 주소 검색으로 고른 주소는 이미
      좌표가 있지만, 직접 입력하거나 이전 축제에서 불러온 주소는 비어 있을 수 있다.
      좌표 없이 보내면 백엔드가 이유 없는 400으로 막고 부스맵도 못 만들기 때문에,
      여기서 채우지 못한 장소가 있으면 저장을 진행하지 않고 이유를 알려 준다.
    */
    setFormError(null);
    setAddressErrorKeys([]);
    setGeocodePending(true);
    let resolved: LocationDraft[];
    try {
      resolved = await Promise.all(
        locations.map(async (location) => {
          if (hasLocationDraftCoordinate(location)) return location;
          const coordinate = await geocodeAddress(location.roadAddress);
          return coordinate ? { ...location, ...coordinate } : location;
        }),
      );
    } finally {
      setGeocodePending(false);
    }
    setLocations(resolved);

    const unresolved = resolved.filter((location) => !hasLocationDraftCoordinate(location));
    if (unresolved.length > 0) {
      const names = unresolved.map((location) => location.locationName.trim() || "이름 없는 장소");
      setAddressErrorKeys(unresolved.map((location) => location.key));
      setFormError(`${names.join(", ")}의 ${ADDRESS_GEOCODE_FAILED_MESSAGE}`);
      return;
    }

    setSubmitLocations(resolved);
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
                  /*
                    주소를 한 번 채우면 입력칸이 잠기므로, 좌표를 못 구했을 때
                    다시 검색할 길을 열어 둔다. 이 버튼이 없으면 등록이 막힌 채로
                    주소를 고칠 방법이 없다.
                  */
                  <Input
                    layout="with-button"
                    disabled
                    value={location.roadAddress}
                    className="disabled:border-zinc-400!"
                    errorText={
                      addressErrorKeys.includes(location.key)
                        ? ADDRESS_GEOCODE_FAILED_MESSAGE
                        : undefined
                    }
                    button={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAddressSearchTargetKey(location.key);
                          setAddressSearchState("default");
                          setAddressManualError(null);
                        }}
                      >
                        주소 변경
                      </Button>
                    }
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddressSearchTargetKey(location.key);
                      setAddressSearchState("default");
                      setAddressManualError(null);
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

      <FormSection label="축제부스지도 첨부">
        <AttachmentField
          file={mapImage}
          onSelect={selectMapImage}
          onRemove={() => {
            setMapImage(null);
            setMapImageError(null);
          }}
          accept={MAP_IMAGE_ACCEPT}
          description="배치도를 첨부하면 AI가 부스 위치를 찾아 부스맵에 표시합니다. 나중에 부스맵 화면에서 첨부해도 됩니다. (PNG·JPG, 50MB 이하)"
          error={mapImageError}
          disabled={createMutation.isPending}
        />
      </FormSection>

      {createMutation.isError ? (
        <p className="body-small text-error">{getApiErrorMessage(createMutation.error)}</p>
      ) : null}

      <Bottombar
        onCancel={() => setCancelDialogOpen(true)}
        onSubmit={handleSubmitClick}
        submitLabel={geocodePending ? "주소 확인 중..." : undefined}
        submitDisabled={geocodePending}
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
          if (series) void applyFestivalSeries(series);
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
            setAddressManualError(null);
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
        manualInputPending={addressManualPending}
        manualInputError={addressManualError}
        onManualInput={async (value) => {
          const targetKey = addressSearchTargetKey;
          if (!targetKey) return;
          if (value.length === 0) {
            setAddressManualError("주소를 입력해 주세요.");
            return;
          }
          /*
            직접 입력한 주소에는 좌표가 없다. 여기서 바로 지오코딩해서, 좌표를
            구한 주소만 폼에 넣는다. 못 구하면 다이얼로그를 닫지 않고 사유를 띄워
            검색으로 다시 고르게 한다 — 예전에는 그대로 통과시켜 등록 단계에서
            이유 없는 400으로 끝났다.
          */
          setAddressManualError(null);
          setAddressManualPending(true);
          try {
            const coordinate = await geocodeAddress(value);
            if (!coordinate) {
              setAddressManualError(ADDRESS_GEOCODE_FAILED_MESSAGE);
              return;
            }
            updateLocation(targetKey, { roadAddress: value, ...coordinate });
            setAddressSearchTargetKey(null);
          } finally {
            setAddressManualPending(false);
          }
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
        onConfirm={() => createMutation.mutate(submitLocations)}
      />
    </div>
  );
}
