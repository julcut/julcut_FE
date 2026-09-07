import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000010";
const previousFestivalId = "00000000-0000-0000-0000-000000000009";
const reportPath = `/console/festivals/${festivalId}/report`;

function ok(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ code: 0, message: "OK", data }),
  };
}

const performance = {
  festivalId,
  performanceAvailable: true,
  generationStatus: "COMPLETED",
  metrics: {
    festivalId,
    festivalName: "테스트 축제",
    festivalYear: 2026,
    totalDayCount: 3,
    visitorInputCompleted: true,
    totalVisitors: {
      current: 51194,
      previous: 39419,
      delta: 11775,
      changeRatePercent: 23,
      direction: "UP",
    },
    dailyTrend: [
      { dayIndex: 1, visitDate: "2026-05-01", currentCount: 900, previousCount: 700 },
      { dayIndex: 2, visitDate: "2026-05-02", currentCount: 1000, previousCount: 820 },
      { dayIndex: 3, visitDate: "2026-05-03", currentCount: 780, previousCount: 640 },
    ],
    economicEffect: { available: true, totalMillionKrw: 164, previousMillionKrw: 160.4 },
    operationEfficiency: { available: true, averageWaitMinutes: 12, boothCount: 30 },
    zoneWaitRanking: [
      { rank: 1, zoneName: "먹거리 구역", averageWaitMinutes: 24 },
      { rank: 2, zoneName: "메인무대 구역", averageWaitMinutes: 19 },
      { rank: 3, zoneName: "체험 구역", averageWaitMinutes: 14 },
      { rank: 4, zoneName: "판매 구역", averageWaitMinutes: 9 },
      { rank: 5, zoneName: "안내 구역", averageWaitMinutes: 5 },
      { rank: 6, zoneName: "주차 구역", averageWaitMinutes: 3 },
    ],
    boothCongestionShare: [],
    visitPattern: { available: false, peakHours: [] },
  },
  ai: {
    performanceSummary: {
      positives: ["폭염·우천 대비 설비 보강으로 관광객 편의 도모"],
      issues: ["일부 부스 운영시간 절반 이상 혼잡 상태 지속"],
      improvements: ["혼잡 부스 인력 증원 및 동선 재배치 검토"],
    },
    evaluation: {
      headlineSentiment: "POSITIVE",
      positiveKeywords: [],
      negativeKeywords: [],
      summary: { positives: [], issues: [], improvements: [] },
    },
  },
};

const review = (id: number, rating: number) => ({
  reviewId: id,
  displayName: "방문객",
  rating,
  content:
    "아이와 함께 참여했는데 체험 프로그램이 정말 체계적이고 재미있었습니다. 내년에도 꼭 다시 오고 싶어요!",
});

const evaluation = {
  festivalId,
  evaluationAvailable: true,
  generationStatus: "COMPLETED",
  reviews: {
    available: true,
    averageScore: 4.36,
    previousAverageScore: 4.23,
    scoreDelta: 0.13,
    reviewCount: 1745,
    ratingDistribution: [
      { rating: 1, count: 35, ratio: 0.02 },
      { rating: 2, count: 70, ratio: 0.04 },
      { rating: 3, count: 175, ratio: 0.1 },
      { rating: 4, count: 611, ratio: 0.35 },
      { rating: 5, count: 854, ratio: 0.49 },
    ],
    featuredReviews: [review(1, 5), review(2, 5), review(3, 2)],
    reviews: Array.from({ length: 12 }, (_, index) => review(index + 1, (index % 5) + 1)),
    hasMore: true,
  },
  ai: {
    headlineSentiment: "POSITIVE",
    positiveKeywords: ["체험 프로그램", "가족 나들이", "친절한 안내", "야경"],
    negativeKeywords: ["주차난", "대기시간", "물량 부족"],
    summary: {
      positives: [
        "폭염 및 우천에 대비한 행사장 환경 개선과 철저한 안전관리로 쾌적한 축제장 분위기 조성",
        "다양한 연령층이 함께 즐길 수 있는 프로그램 운영으로 가족 단위 관광객 유치와 지역경제 활성화에 기여",
      ],
      issues: ["축제 마지막 날 물량 부족, 특정 시간대 교통 혼잡 등 개선 필요"],
      improvements: ["혼잡 부스 인력 증원 및 동선 재배치 검토"],
    },
  },
};

async function mockReport(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.com",
        name: "테스트 관리자",
        organization: "축제 운영팀",
        rank: null,
        accountKind: "GOVERNMENT",
        status: "ACTIVE",
      };
    } else if (path === `/api/admin/me/managed-festivals/${festivalId}`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        role: "FESTIVAL_OWNER",
        festivalStatus: "CLOSED",
        locations: [],
      };
    } else if (path.endsWith("/reports/status")) {
      data = {
        festivalId,
        progressStatus: "DONE",
        visitorInput: "COMPLETE",
        generationStatus: "COMPLETED",
        progressDayIndex: null,
        progressMessage: null,
        performanceAvailable: true,
        evaluationAvailable: true,
        previousFestivalId,
        generatedAt: "2026-05-04T00:00:00Z",
        jobId: "job-1",
      };
    } else if (path.endsWith("/operations/visitors")) {
      data = {
        festivalId,
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        visitorCountInputMode: "DAILY",
        days: [],
        filledDayCount: 3,
        totalDayCount: 3,
        allDaysFilled: true,
        sumVisitorCount: 51194,
        totalOverrideVisitorCount: null,
        totalSaved: false,
        effectiveVisitorCount: 51194,
        effectiveSource: "DAILY_SUM",
        effectiveStatus: "READY",
        difference: null,
        reportReadyToGenerate: false,
      };
    } else if (path.endsWith("/reports/performance")) {
      data = performance;
    } else if (path.endsWith("/reports/evaluation")) {
      data = evaluation;
    }
    await route.fulfill(
      data === undefined
        ? {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ code: 404, message: "NOT_FOUND", data: null }),
          }
        : ok(data),
    );
  });
}

test("결과리포트는 브레드크럼으로 축제성과·방문객평가를 전환하고 전체 리뷰 모달을 연다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockReport(page);
  await page.goto(reportPath);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("23%");
  await expect(page.getByText("구역별 혼잡도 랭킹")).toBeVisible();
  await expect(page.getByText("일차/시간대별 방문 패턴")).toBeVisible();
  await expect(page.getByText("혼잡도 단계별 지속시간 비율")).toBeVisible();
  // 상위 5개만 노출되는지 (주차 구역은 6위라 빠져야 함)
  await expect(page.getByText("주차 구역")).toHaveCount(0);
  // 지난 리포트 보기 링크가 직전 회차 리포트로 연결된다.
  await expect(page.getByRole("link", { name: /지난 리포트 보기/ })).toHaveAttribute(
    "href",
    `/console/festivals/${previousFestivalId}/report`,
  );

  // 브레드크럼 드롭다운으로 방문객평가 전환
  await page.getByRole("button", { name: "축제성과" }).click();
  await page.getByRole("menuitemradio", { name: "방문객평가" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("긍정적인");
  await expect(page.getByText("종합 만족도 점수")).toBeVisible();
  await expect(page.getByText("종합평가", { exact: true })).toBeVisible();

  // 5-1. 전체 리뷰 보기 모달
  await page.getByRole("button", { name: "전체 리뷰 보기" }).click();
  await expect(page.getByRole("dialog").getByText("전체 리뷰", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();

  // 좁은 화면에서도 주요 영역이 그대로 보인다.
  await page.setViewportSize({ width: 420, height: 900 });
  await expect(page.getByText("종합 만족도 점수")).toBeVisible();
});

test("집계 방식이 없으면 방문 인원 입력 폼 안에서 총합/일자별을 먼저 고른다", async ({ page }) => {
  const saved: string[] = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.com",
        name: "테스트 관리자",
        organization: "축제 운영팀",
        rank: null,
        accountKind: "GOVERNMENT",
        status: "ACTIVE",
      };
    } else if (path === `/api/admin/me/managed-festivals/${festivalId}`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        role: "FESTIVAL_OWNER",
        festivalStatus: "DRAFT",
        progressStatus: "COMPLETED",
        visitorCountInputMode: "UNSET",
        locations: [],
      };
    } else if (path.endsWith("/reports/status")) {
      data = {
        festivalId,
        progressStatus: "DONE",
        visitorInput: "MISSING",
        generationStatus: "NONE",
        progressDayIndex: null,
        progressMessage: null,
        performanceAvailable: false,
        evaluationAvailable: false,
        previousFestivalId: null,
        generatedAt: null,
        jobId: null,
      };
    } else if (path.endsWith("/operations/visitors")) {
      data = {
        festivalId,
        startDate: "2026-05-01",
        endDate: "2026-05-02",
        visitorCountInputMode: "UNSET",
        days: [
          {
            visitDate: "2026-05-01",
            dayIndex: 1,
            visitorCount: null,
            inputAllowed: true,
            saved: false,
          },
          {
            visitDate: "2026-05-02",
            dayIndex: 2,
            visitorCount: null,
            inputAllowed: true,
            saved: false,
          },
        ],
        filledDayCount: 0,
        totalDayCount: 2,
        allDaysFilled: false,
        sumVisitorCount: 0,
        totalOverrideVisitorCount: null,
        totalSaved: false,
        effectiveVisitorCount: null,
        effectiveSource: "NONE",
        effectiveStatus: "UNSET",
        difference: null,
        reportReadyToGenerate: false,
      };
    } else if (path.endsWith("/operations/visitors/total")) {
      saved.push(`${request.method()} ${path}`);
      data = null;
    }
    await route.fulfill(
      data === undefined
        ? {
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ code: 404, message: "NOT_FOUND", data: null }),
          }
        : ok(data),
    );
  });

  await page.goto(reportPath);

  // 집계 방식을 고르기 전에는 입력 필드도, 활성화된 입력하기 버튼도 없다.
  const submit = page.getByRole("button", { name: "입력하기" });
  await expect(page.getByRole("radio", { name: "총합 입력" })).toBeVisible();
  await expect(submit).toBeDisabled();

  await page.getByRole("radio", { name: "총합 입력" }).click();
  await page.getByLabel("총 방문객").fill("51194");
  await expect(submit).toBeEnabled();
  await submit.click();

  // 축제 수정 API는 부르지 않고, 총합 저장으로 백엔드가 집계 방식을 잠그게 둔다.
  await expect
    .poll(() => saved)
    .toEqual([`PUT /api/festivals/${festivalId}/operations/visitors/total`]);
});
