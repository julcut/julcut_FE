export const DATE_DISPLAY_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;

/** "yyyy-MM-dd"를 화면 표기 "YYYY.mm.dd"로 변환한다. */
export function toDisplayDate(isoDate: string) {
  return isoDate.replaceAll("-", ".");
}

/** "YYYY.mm.dd" 화면 표기를 API가 요구하는 "yyyy-MM-dd"로 변환한다. */
export function toIsoDate(displayDate: string) {
  return displayDate.replaceAll(".", "-");
}

/** 오늘부터 축제 시작일까지 남은 일수. 자정 기준 캘린더 일수 차이로 계산한다. */
export function calculateDday(isoStartDate: string) {
  const [year, month, day] = isoStartDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 남은 일수를 "D-3" / "D-DAY" / "D+2" 표기로 변환한다. */
export function formatDday(isoStartDate: string) {
  const dday = calculateDday(isoStartDate);
  if (dday === 0) return "D-DAY";
  return dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`;
}

/** 숫자만 입력받아 "YYYY.mm.dd" 형태로 자동 포맷팅한다. */
export function formatDateInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join(".");
}
