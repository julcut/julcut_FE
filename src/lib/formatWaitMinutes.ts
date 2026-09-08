/** 대기분 표시. 0은 "0분", 없거나 null은 "정보 없음". */
export function formatWaitMinutes(waitMinutes: number | null | undefined): string {
  if (waitMinutes == null) return "정보 없음";
  return `${waitMinutes}분`;
}
