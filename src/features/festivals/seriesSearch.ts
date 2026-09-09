import type { SearchDialogResult } from "./SearchDialog";
import { toDisplayDate } from "./dateFormat";
import type { FestivalSeriesSearchResult } from "./types";

/**
 * 축제 검색 모달에 쓰는 안내 문구. 축제 등록/수정 두 화면이 같은 모달을 쓴다.
 */
export const FESTIVAL_SEARCH_HELPER_TEXT = "축제명으로 검색하면 이전 축제 정보를 불러올 수 있어요.";

export const FESTIVAL_SEARCH_HELPER_ITEMS = [
  "이미 등록된 축제는 가장 최근 회차 정보를 불러옵니다",
  "등록 전 축제는 공공데이터에 있는 정보를 불러옵니다",
];

/**
 * 검색 결과 한 건을 목록에서 구분하는 키.
 *
 * 시리즈로 묶인 축제는 시리즈 UUID를 쓰고, 아직 시리즈가 없는 축제(공공데이터
 * 파이프라인 적재분)는 `seriesId`가 비어 있어 축제 UUID로 구분한다.
 */
export function festivalSearchResultKey(series: FestivalSeriesSearchResult) {
  return series.seriesId ?? series.latestFestivalId ?? series.name;
}

/** 축제 검색 결과를 공용 검색 모달이 이해하는 형태로 바꾼다. */
export function toFestivalSearchDialogResult(
  series: FestivalSeriesSearchResult,
): SearchDialogResult {
  return {
    id: festivalSearchResultKey(series),
    label: series.name,
    description: series.latestAddress ?? undefined,
  };
}

/** 모달이 돌려준 선택 id로 원본 검색 결과를 되찾는다. */
export function findFestivalSearchResult(results: FestivalSeriesSearchResult[], id: string) {
  return results.find((series) => festivalSearchResultKey(series) === id);
}

/**
 * 검색 결과의 "yyyy-MM-dd"를 화면 표기로 바꾼다.
 *
 * 공공데이터 축제는 기간이 비어 있을 수 있어서, 값이 없으면 입력칸을 비워 둔다.
 */
export function toDisplayDateOrEmpty(isoDate: string | null) {
  return isoDate ? toDisplayDate(isoDate) : "";
}
