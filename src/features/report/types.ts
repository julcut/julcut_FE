import type { CongestionLevel } from "@/features/dashboard/types";

export interface FestivalReportSummary {
  festivalId: string;
  dataAvailable: boolean;
  totalVisitorCount: number;
  peakConcurrentVisitorCount: number;
  averageWaitMinutes: number;
  generatedAt: string | null;
}

export interface FestivalVisitorDay {
  visitDate: string;
  dayIndex: number;
  visitorCount: number | null;
  inputAllowed: boolean;
  saved: boolean;
}
export interface FestivalVisitorCounts {
  festivalId: string;
  startDate: string;
  endDate: string;
  visitorCountInputMode: "UNSET" | "DAILY" | "TOTAL";
  days: FestivalVisitorDay[];
  filledDayCount: number;
  totalDayCount: number;
  allDaysFilled: boolean;
  sumVisitorCount: number;
  totalOverrideVisitorCount: number | null;
  totalSaved: boolean;
  effectiveVisitorCount: number | null;
  effectiveSource: "NONE" | "DAILY_SUM" | "TOTAL";
  effectiveStatus: "UNSET" | "PARTIAL" | "READY" | "CONFLICT";
  difference: number | null;
  reportReadyToGenerate: boolean;
}
export interface FestivalReportStatus {
  festivalId: string;
  progressStatus: string;
  visitorInput: "MISSING" | "PARTIAL" | "COMPLETE";
  generationStatus: "NONE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progressDayIndex: number | null;
  progressMessage: string | null;
  performanceAvailable: boolean;
  evaluationAvailable: boolean;
  previousFestivalId: string | null;
  generatedAt: string | null;
  jobId: string | null;
}
export interface FestivalReportGenerateResult {
  festivalId: string;
  jobId: string;
  status: string;
}

export type VisitorChangeDirection = "UP" | "DOWN" | "FLAT" | "NONE";

export interface FestivalReportTextSummary {
  positives: string[];
  issues: string[];
  improvements: string[];
}

export interface FestivalReportPerformance {
  festivalId: string;
  performanceAvailable: boolean;
  generationStatus: string;
  metrics: {
    festivalId: string;
    festivalName: string;
    festivalYear: number;
    totalDayCount: number;
    visitorInputCompleted: boolean;
    totalVisitors: {
      current: number;
      previous: number | null;
      delta: number | null;
      changeRatePercent: number | null;
      direction: VisitorChangeDirection;
    };
    dailyTrend: Array<{
      dayIndex: number;
      visitDate: string;
      currentCount: number | null;
      previousCount: number | null;
    }>;
    economicEffect: {
      available: boolean;
      totalMillionKrw: number | null;
      previousMillionKrw: number | null;
    };
    operationEfficiency: {
      available: boolean;
      averageWaitMinutes: number | null;
      boothCount: number;
    };
    zoneWaitRanking: Array<{ rank: number; zoneName: string; averageWaitMinutes: number }>;
    boothCongestionShare: Array<{ congestionLevel: string; sharePercent: number }>;
    visitPattern: { available: boolean; peakHours: string[] };
  };
  ai: {
    performanceSummary: FestivalReportTextSummary;
    evaluation: FestivalReportEvaluationAi;
  };
}

export interface FestivalReportEvaluationAi {
  headlineSentiment: string;
  positiveKeywords: string[];
  negativeKeywords: string[];
  summary: FestivalReportTextSummary;
}

export interface FestivalReviewItem {
  reviewId: number | null;
  displayName: string;
  rating: number | null;
  content: string;
}

export interface FestivalReportEvaluation {
  festivalId: string;
  evaluationAvailable: boolean;
  generationStatus: string;
  reviews: {
    available: boolean;
    averageScore: number | null;
    previousAverageScore: number | null;
    scoreDelta: number | null;
    reviewCount: number;
    ratingDistribution: Array<{ rating: number; count: number; ratio: number }>;
    featuredReviews: FestivalReviewItem[];
    reviews: FestivalReviewItem[];
    hasMore: boolean;
  };
  ai: FestivalReportEvaluationAi;
}

/**
 * 아래 두 타입은 화면설계서 3-4(일차/시간대별 방문 패턴 히트맵)와
 * 3-6(부스 혼잡도 단계별 지속시간 비율)이 요구하는 데이터 모양이다.
 * 백엔드 응답에는 아직 대응 필드가 없어 `mockData.ts`의 목업으로 채운다.
 */
export interface VisitPatternRow {
  dayIndex: number;
  hours: Array<{ hour: number; visitorCount: number }>;
}

export interface BoothCongestionDurationRow {
  boothName: string;
  /** 혼잡도 단계별 지속시간 비율(%). 부스마다 합이 100이 되도록 한다. */
  shares: Record<CongestionLevel, number>;
}
