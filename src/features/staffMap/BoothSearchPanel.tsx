"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/Input";
import { BoothZoneList } from "@/features/dashboard/BoothTreeSidebar";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { useStaffFestival } from "./useStaffFestival";

export function BoothSearchPanel() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const festival = useStaffFestival();

  const trimmedKeyword = keyword.trim();
  const matched = useMemo(() => {
    if (!trimmedKeyword) return [];
    return festival.zones.flatMap((zone) =>
      zone.booths
        .filter((booth) => booth.name.includes(trimmedKeyword))
        .map((booth) => ({ booth, zoneName: zone.name })),
    );
  }, [festival.zones, trimmedKeyword]);

  const openBooth = (boothId: string) => {
    router.push(`/staff/dashboard?boothId=${encodeURIComponent(boothId)}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h1 className="heading-small text-zinc-950">부스 찾기</h1>

      <div className="relative">
        <Input
          type="text"
          placeholder="부스명을 입력하세요"
          aria-label="부스명 검색"
          value={keyword}
          className="pr-10"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {trimmedKeyword ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              className="text-zinc-500"
              onClick={() => setKeyword("")}
            >
              <Cross2Icon className="size-4" />
            </button>
          ) : (
            <MagnifyingGlassIcon className="size-4 text-zinc-500" />
          )}
        </span>
      </div>

      {festival.isLoading ? (
        <p className="body-small text-zinc-500">부스를 불러오는 중...</p>
      ) : null}

      {festival.error ? (
        <p className="body-small text-error">
          {getApiErrorMessage(festival.error, "부스를 불러오지 못했습니다.")}
        </p>
      ) : null}

      {!festival.isLoading && !festival.error ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {trimmedKeyword ? (
            <>
              <p className="body-large-bold px-2 py-1.5 text-zinc-950">
                검색결과 <span className="text-primary">{matched.length}</span>
              </p>
              {matched.length === 0 ? (
                <p className="body-small px-2 py-4 text-zinc-500">검색 결과가 없습니다.</p>
              ) : (
                <ul className="flex flex-col">
                  {matched.map(({ booth, zoneName }) => (
                    <li key={booth.boothId} className="border-b border-zinc-200">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-2 py-3 text-left hover:bg-zinc-100"
                        onClick={() => openBooth(booth.boothId)}
                      >
                        <span className="body-regular-bold text-zinc-950">{booth.name}</span>
                        <span className="body-caption text-zinc-500">{zoneName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <BoothZoneList
              zones={festival.zones}
              title="전체 부스"
              selectedBoothId={undefined}
              onSelectBooth={(booth) => openBooth(booth.boothId)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
