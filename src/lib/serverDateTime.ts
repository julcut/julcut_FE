/** 문자열 끝에 `Z`나 `+09:00` 같은 타임존 표기가 붙어 있는지. */
const TIME_ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * 서버가 내려준 시각 문자열을 밀리초 타임스탬프로 읽는다.
 *
 * 백엔드는 갱신 시각을 UTC로 계산해 내려주면서 타임존 표기를 붙이지 않는다
 * (`2026-09-09T05:06:37`). 이 문자열을 그대로 `new Date`에 넣으면 브라우저가
 * 로컬 시간으로 해석해 한국에서는 정확히 9시간 어긋난 값이 나온다. 그래서 시각이
 * 포함된 문자열에 타임존 표기가 없으면 UTC로 못박아 읽는다.
 *
 * 날짜만 있는 문자열(`2026-09-02`)과 이미 타임존이 붙은 문자열은 손대지 않는다.
 * 축제 시작일에서 계산하는 스태프 계정 유효 기간처럼 "그 지역의 달력 날짜"를
 * 뜻하는 값은 UTC로 읽으면 오히려 하루가 밀리므로 이 함수를 쓰지 않는다.
 */
export function parseServerDateTime(value: string): number {
  const hasTime = value.includes("T");
  const normalized = !hasTime || TIME_ZONE_SUFFIX.test(value) ? value : `${value}Z`;
  return new Date(normalized).getTime();
}
