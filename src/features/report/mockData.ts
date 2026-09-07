/**
 * 결과리포트 화면설계서(RPT01)에는 있지만 백엔드가 아직 내려주지 않는 항목의 목업 데이터.
 *
 * 이 파일의 상수는 전부 **가짜 데이터**다. 백엔드 API가 실제 필드를 내려주기
 * 시작하면 이 파일을 통째로 지우고 `types.ts`의 응답 타입에서 값을 받아 쓴다.
 * 어떤 필드가 필요한지는 각 상수 위 주석에 적어 두었다.
 *
 * 목업이 화면에 쓰이고 있다는 사실은 각 패널의 "예시 데이터" 배지로도 드러난다.
 */

import type { BoothCongestionDurationRow, VisitPatternRow } from "./types";

/** 목업 데이터가 화면에 노출될 때 패널에 붙이는 배지 문구. */
export const MOCK_BADGE_LABEL = "예시 데이터";

/**
 * 3-4. 일차/시간대별 방문 패턴 히트맵.
 *
 * 필요한 API 필드(현재 없음):
 *   metrics.visitPattern.hourlyByDay:
 *     Array<{ dayIndex: number; visitDate: string;
 *             hours: Array<{ hour: number; visitorCount: number }> }>
 */
export const MOCK_VISIT_PATTERN_ROWS: VisitPatternRow[] = [1, 2, 3].map((dayIndex) => ({
  dayIndex,
  hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => ({
    hour,
    // 점심(12시)과 저녁(18시)에 두 번 몰리는 축제 방문 패턴을 흉내 낸 값이다.
    visitorCount: Math.round(
      120 +
        dayIndex * 40 +
        260 * Math.exp(-((hour - 12) ** 2) / 4) +
        340 * Math.exp(-((hour - 18) ** 2) / 5),
    ),
  })),
}));

/**
 * 3-6. 부스 혼잡도 단계별 지속시간 비율.
 *
 * 현재 백엔드의 `metrics.boothCongestionShare`는 축제 전체를 혼잡도 단계별로만
 * 쪼갠 값이라 설계서가 요구하는 "부스별" 분해를 만들 수 없다.
 *
 * 필요한 API 필드(현재 없음):
 *   metrics.boothCongestionDuration:
 *     Array<{ boothId: number; boothName: string;
 *             shares: Array<{ congestionLevel: "LOW"|"MEDIUM"|"HIGH"; sharePercent: number }> }>
 *   (sharePercent 합은 부스마다 100)
 */
export const MOCK_BOOTH_CONGESTION_DURATION: BoothCongestionDurationRow[] = [
  { boothName: "먹거리 장터", shares: { LOW: 18, MEDIUM: 30, HIGH: 52 } },
  { boothName: "메인 무대 앞", shares: { LOW: 24, MEDIUM: 33, HIGH: 43 } },
  { boothName: "체험 공방", shares: { LOW: 35, MEDIUM: 34, HIGH: 31 } },
  { boothName: "야외 포토존", shares: { LOW: 46, MEDIUM: 30, HIGH: 24 } },
  { boothName: "농특산물 판매", shares: { LOW: 58, MEDIUM: 27, HIGH: 15 } },
  { boothName: "안내 데스크", shares: { LOW: 71, MEDIUM: 21, HIGH: 8 } },
];
