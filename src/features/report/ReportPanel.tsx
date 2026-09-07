"use client";

import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { cn } from "@/lib/utils";
import { AllReviewsDialog } from "./AllReviewsDialog";
import { getFestivalReportEvaluation, getFestivalReportPerformance } from "./api";
import { BoothCongestionDurationChart } from "./charts/BoothCongestionDurationChart";
import { RatingDistributionChart } from "./charts/RatingDistributionChart";
import { VisitPatternHeatmap } from "./charts/VisitPatternHeatmap";
import { ZoneWaitRankingChart } from "./charts/ZoneWaitRankingChart";
import {
  MOCK_BADGE_LABEL,
  MOCK_BOOTH_CONGESTION_DURATION,
  MOCK_VISIT_PATTERN_ROWS,
} from "./mockData";
import { ReportBreadcrumb, type ReportSection } from "./ReportBreadcrumb";
import { ReviewCard } from "./ReviewCard";
import type {
  FestivalReportEvaluation,
  FestivalReportPerformance,
  FestivalReportTextSummary,
} from "./types";

function SummaryCard({
  label,
  value,
  unit,
  helper,
  helperTone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  helperTone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-5">
      <p className="body-regular-bold text-zinc-950">{label}</p>
      <div>
        <p className="flex items-baseline gap-1">
          <span className="heading-small text-zinc-950">{value}</span>
          {unit ? <span className="body-regular text-zinc-950">{unit}</span> : null}
        </p>
        {helper ? (
          <p
            className={cn(
              "mt-1 body-caption",
              helperTone === "up" && "text-secondary-600",
              helperTone === "down" && "text-red-600",
              helperTone === "neutral" && "text-zinc-500",
            )}
          >
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  mocked = false,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  /** 목업 데이터로 그린 패널이면 true — 화면에 "예시 데이터" 배지를 붙인다. */
  mocked?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border border-zinc-300 bg-white p-5", className)}>
      {title ? (
        <div className="flex min-h-[29px] items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 body-regular-bold text-zinc-950">
            {title}
            {mocked ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 body-caption text-zinc-500">
                {MOCK_BADGE_LABEL}
              </span>
            ) : null}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={title ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white px-6 py-12 text-center">
      <p className="body-regular text-zinc-500">{message}</p>
    </div>
  );
}

function VisitorTrend({ data }: { data: FestivalReportPerformance["metrics"]["dailyTrend"] }) {
  if (!data.length) return <p className="body-small text-zinc-400">방문 추이 데이터가 없습니다.</p>;
  const maximum = Math.max(
    1,
    ...data.flatMap((item) => [item.currentCount ?? 0, item.previousCount ?? 0]),
  );
  const points = (key: "currentCount" | "previousCount") =>
    data
      .map(
        (item, index) =>
          `${data.length === 1 ? 50 : (index * 100) / (data.length - 1)},${110 - ((item[key] ?? 0) / maximum) * 90}`,
      )
      .join(" ");
  return (
    <div>
      <svg
        viewBox="0 0 100 120"
        className="h-52 w-full"
        preserveAspectRatio="none"
        aria-label="일자별 방문객 추이 차트"
      >
        {[20, 50, 80, 110].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="var(--color-zinc-200)"
            strokeWidth="0.5"
          />
        ))}
        <polyline
          points={points("previousCount")}
          fill="none"
          stroke="var(--color-zinc-400)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <polyline
          points={points("currentCount")}
          fill="none"
          stroke="var(--color-primary-600)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex justify-between body-caption text-zinc-500">
        {data.map((item) => (
          <span key={item.visitDate}>{item.dayIndex}일차</span>
        ))}
      </div>
      <div className="mt-4 flex gap-5 body-caption text-zinc-500">
        <span>━ 올해</span>
        <span>┄ 전년도</span>
      </div>
    </div>
  );
}

/** 설계서 3-1 / 4. 증감·감성에 따라 강조 색이 바뀌는 리포트 상단 타이틀. */
function ReportHeadline({
  before,
  highlight,
  after,
  tone,
}: {
  before: string;
  highlight?: string;
  after?: string;
  tone: "up" | "down" | "neutral";
}) {
  return (
    <h1 className="heading-large text-zinc-950">
      {before}
      {highlight ? (
        <span
          className={cn(
            tone === "up" && "text-secondary-600",
            tone === "down" && "text-red-600",
            tone === "neutral" && "text-zinc-950",
          )}
        >
          {highlight}
        </span>
      ) : null}
      {after}
    </h1>
  );
}

function PerformanceView({ report }: { report: FestivalReportPerformance }) {
  if (!report.performanceAvailable)
    return <EmptyState message="아직 제공할 수 있는 축제 성과 데이터가 없습니다." />;
  const { metrics } = report;
  const visitors = metrics.totalVisitors;
  const tone =
    visitors.direction === "DOWN" ? "down" : visitors.direction === "UP" ? "up" : "neutral";
  const directionLabel =
    visitors.direction === "DOWN" ? "감소" : visitors.direction === "FLAT" ? "변동 없음" : "증가";
  const economic = metrics.economicEffect;
  const efficiency = metrics.operationEfficiency;
  // 백엔드가 아직 zoneWaitRanking을 채우지 않으면 설계서 3-5의 형태를 확인할 수 없어
  // 빈 상태를 그대로 보여준다(목업으로 대체하지 않는다 — 필드는 이미 계약에 있다).
  const zoneRanking = metrics.zoneWaitRanking;

  return (
    <>
      {visitors.changeRatePercent === null ? (
        <ReportHeadline before={`${metrics.festivalName}의 성과를 확인해 보세요.`} tone="neutral" />
      ) : (
        <ReportHeadline
          before="이번 축제, 지난 축제보다 방문객이 "
          highlight={`${Math.abs(visitors.changeRatePercent).toLocaleString()}%`}
          after={` ${directionLabel}${visitors.direction === "FLAT" ? "입니다" : "했습니다"}`}
          tone={tone}
        />
      )}

      {/* 3-2. 요약카드(3열) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="총 관광객수"
          value={visitors.current.toLocaleString()}
          unit="명"
          helper={
            visitors.previous === null
              ? "비교할 이전 축제 데이터가 없습니다."
              : `전년대비 ${Math.abs(visitors.delta ?? 0).toLocaleString()}명 ${directionLabel}`
          }
          helperTone={visitors.previous === null ? "neutral" : tone}
        />
        <SummaryCard
          label="경제효과"
          value={
            economic.available && economic.totalMillionKrw !== null
              ? economic.totalMillionKrw.toLocaleString()
              : "데이터 미제공"
          }
          unit={economic.available && economic.totalMillionKrw !== null ? "백만원" : undefined}
          helper={
            economic.available &&
            economic.previousMillionKrw !== null &&
            economic.totalMillionKrw !== null
              ? `전년대비 ${Math.abs(economic.totalMillionKrw - economic.previousMillionKrw).toLocaleString()}백만원 ${
                  economic.totalMillionKrw >= economic.previousMillionKrw ? "증가" : "감소"
                }`
              : undefined
          }
          helperTone={
            economic.available &&
            economic.previousMillionKrw !== null &&
            economic.totalMillionKrw !== null
              ? economic.totalMillionKrw >= economic.previousMillionKrw
                ? "up"
                : "down"
              : "neutral"
          }
        />
        <SummaryCard
          label="운영효율(평균 대기시간)"
          value={
            efficiency.available && efficiency.averageWaitMinutes !== null
              ? efficiency.averageWaitMinutes.toLocaleString()
              : "데이터 미제공"
          }
          unit={efficiency.available && efficiency.averageWaitMinutes !== null ? "분" : undefined}
          helper={
            efficiency.available
              ? `참여부스 ${efficiency.boothCount.toLocaleString()}개`
              : undefined
          }
        />
      </div>

      {/* 3-3(2/3) 일자별 관광객 추이 + 3-4(1/3) 일차/시간대별 방문 패턴 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="일자별 관광객 추이" className="lg:col-span-2">
          <VisitorTrend data={metrics.dailyTrend} />
        </Panel>
        <Panel title="일차/시간대별 방문 패턴" mocked>
          <VisitPatternHeatmap rows={MOCK_VISIT_PATTERN_ROWS} />
        </Panel>
      </div>

      {/* 3-5(1/3) 구역별 혼잡도 랭킹 + 3-6(2/3) 혼잡도 단계별 지속시간 비율 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="구역별 혼잡도 랭킹">
          <ZoneWaitRankingChart ranking={zoneRanking} />
        </Panel>
        <Panel title="혼잡도 단계별 지속시간 비율" className="lg:col-span-2" mocked>
          <BoothCongestionDurationChart rows={MOCK_BOOTH_CONGESTION_DURATION} />
        </Panel>
      </div>

      <TextSummary summary={report.ai.performanceSummary} />
    </>
  );
}

/** 축제성과 화면 하단의 AI 요약(설계서 mock에는 없지만 이미 붙어 있던 영역). */
function TextSummary({ summary }: { summary: FestivalReportTextSummary }) {
  const groups = [
    { title: "잘한 점", items: summary.positives },
    { title: "아쉬운 점", items: summary.issues },
    { title: "개선 제안", items: summary.improvements },
  ];
  if (groups.every(({ items }) => items.length === 0)) return null;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ title, items }) => (
        <Panel key={title} title={title}>
          {items.length ? (
            <ul className="flex list-disc flex-col gap-2 pl-4 body-small text-zinc-600">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="body-small text-zinc-400">분석 내용이 없습니다.</p>
          )}
        </Panel>
      ))}
    </div>
  );
}

const SENTIMENT_HEADLINE: Record<string, { highlight: string; tone: "up" | "down" | "neutral" }> = {
  POSITIVE: { highlight: "긍정적인", tone: "up" },
  NEGATIVE: { highlight: "부정적인", tone: "down" },
  NEUTRAL: { highlight: "무난한", tone: "neutral" },
};

/** 설계서 6. 종합평가 — 요약 문단 + 긍정적인 점 + 미흡한 점/개선방안. */
function OverallEvaluation({ summary }: { summary: FestivalReportTextSummary }) {
  const hasContent =
    summary.positives.length > 0 || summary.issues.length > 0 || summary.improvements.length > 0;
  if (!hasContent) return null;
  // 백엔드에 '종합평가 한 문단' 필드가 없어, 긍정/미흡 항목을 이어 붙여 개요를 만든다.
  const overview = [...summary.positives, ...summary.issues].join(" · ");

  return (
    <Panel>
      <div className="flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-2 body-regular-bold text-zinc-950">
            종합평가
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="종합평가 설명">
                  <QuestionMarkCircledIcon className="size-3.5 text-zinc-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                리뷰와 운영 데이터를 AI가 분석해 정리한 축제 총평입니다.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-3 max-w-3xl body-small text-zinc-600">
            {overview || "분석 내용이 없습니다."}
          </p>
        </div>

        {summary.positives.length ? (
          <div>
            <p className="body-regular-bold text-zinc-950">긍정적인 점</p>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 body-small text-zinc-600">
              {summary.positives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <p className="body-regular-bold text-zinc-950">미흡한 점</p>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 body-small text-zinc-600">
              {summary.issues.length ? (
                summary.issues.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li className="list-none pl-0 text-zinc-400">분석 내용이 없습니다.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="body-regular-bold text-zinc-950">개선방안</p>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 body-small text-zinc-600">
              {summary.improvements.length ? (
                summary.improvements.map((item) => <li key={item}>{item}</li>)
              ) : (
                <li className="list-none pl-0 text-zinc-400">분석 내용이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function EvaluationView({ report }: { report: FestivalReportEvaluation }) {
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  // 백엔드의 evaluationAvailable은 AI 분석이 꺼져 있으면 항상 false다.
  // 리뷰 집계는 AI와 무관하게 채워지므로 reviews.available도 함께 본다.
  if (!report.evaluationAvailable && !report.reviews.available)
    return <EmptyState message="아직 제공할 수 있는 방문객 평가 데이터가 없습니다." />;

  const { reviews } = report;
  const featured = reviews.featuredReviews.length
    ? reviews.featuredReviews.slice(0, 3)
    : reviews.reviews.slice(0, 3);
  const sentiment = SENTIMENT_HEADLINE[report.ai.headlineSentiment];
  const scoreDeltaLabel =
    reviews.scoreDelta === null
      ? undefined
      : `전년대비 ${Math.abs(reviews.scoreDelta).toFixed(2)}점 ${reviews.scoreDelta >= 0 ? "증가" : "감소"}`;

  return (
    <>
      {sentiment ? (
        <ReportHeadline
          before="이번 축제는 "
          highlight={sentiment.highlight}
          after=" 반응이에요"
          tone={sentiment.tone}
        />
      ) : (
        <ReportHeadline before="방문객이 남긴 평가를 확인해 보세요." tone="neutral" />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 종합 만족도 점수: 평균 별점 + 전년 대비 증감 + 평점 분포 히스토그램 + 총 리뷰 수 */}
        <Panel title="종합 만족도 점수">
          <div className="flex flex-col gap-6">
            <div>
              <p className="flex items-baseline gap-1">
                <span className="heading-small text-zinc-950">
                  {reviews.averageScore === null ? "-" : reviews.averageScore.toFixed(2)}
                </span>
                <span className="body-regular text-zinc-950">점</span>
              </p>
              {scoreDeltaLabel ? (
                <p
                  className={cn(
                    "mt-1 body-caption",
                    (reviews.scoreDelta ?? 0) >= 0 ? "text-secondary-600" : "text-red-600",
                  )}
                >
                  {scoreDeltaLabel}
                </p>
              ) : null}
            </div>
            <RatingDistributionChart distribution={reviews.ratingDistribution} />
            <p className="body-small text-zinc-500">
              총 리뷰{" "}
              <span className="body-small-bold text-zinc-950">
                {reviews.reviewCount.toLocaleString()}건
              </span>
            </p>
          </div>
        </Panel>

        <Panel title="방문객 평가 키워드" className="lg:col-span-2">
          <div className="flex flex-col gap-6">
            <KeywordGroup
              title="긍정"
              keywords={report.ai.positiveKeywords}
              className="bg-primary-300"
            />
            <KeywordGroup
              title="부정"
              keywords={report.ai.negativeKeywords}
              className="bg-red-300"
            />
          </div>
        </Panel>
      </div>

      {/* 방문객 대표 리뷰 + 5-1. 전체 리뷰 보기 */}
      <Panel
        title="방문객 대표 리뷰"
        action={
          reviews.reviews.length ? (
            <Button variant="outline" size="sm" onClick={() => setAllReviewsOpen(true)}>
              전체 리뷰 보기
            </Button>
          ) : null
        }
      >
        {featured.length ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {featured.map((review, index) => (
              <li key={review.reviewId ?? `${review.displayName}-${index}`}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-small text-zinc-400">표시할 리뷰가 없습니다.</p>
        )}
      </Panel>

      <OverallEvaluation summary={report.ai.summary} />

      <AllReviewsDialog
        open={allReviewsOpen}
        onOpenChange={setAllReviewsOpen}
        reviews={reviews.reviews}
        reviewCount={reviews.reviewCount}
        hasMore={reviews.hasMore}
      />
    </>
  );
}

function KeywordGroup({
  title,
  keywords,
  className,
}: {
  title: string;
  keywords: string[];
  className: string;
}) {
  return (
    <div>
      <p className="mb-2 body-small-bold text-zinc-950">{title}</p>
      <div className="flex flex-wrap gap-2">
        {keywords.length ? (
          keywords.map((keyword) => (
            <span key={keyword} className={`rounded-full px-3 py-1 body-small ${className}`}>
              {keyword}
            </span>
          ))
        ) : (
          <span className="body-small text-zinc-400">키워드 없음</span>
        )}
      </div>
    </div>
  );
}

export function ReportPanel({ festivalId }: { festivalId: string }) {
  const [activeSection, setActiveSection] = useState<ReportSection>("축제성과");
  const performanceQuery = useQuery({
    queryKey: ["festival-report-performance", festivalId],
    queryFn: () => getFestivalReportPerformance(festivalId),
    enabled: activeSection === "축제성과",
  });
  const evaluationQuery = useQuery({
    queryKey: ["festival-report-evaluation", festivalId],
    queryFn: () => getFestivalReportEvaluation(festivalId),
    enabled: activeSection === "방문객평가",
  });
  const activeQuery = activeSection === "축제성과" ? performanceQuery : evaluationQuery;

  return (
    <div id="festival-performance" className="flex flex-col gap-6">
      <ReportBreadcrumb section={activeSection} onSectionChange={setActiveSection} />
      {activeQuery.isLoading ? (
        <p className="body-regular text-zinc-500">리포트를 불러오는 중...</p>
      ) : null}
      {activeQuery.isError ? (
        <p className="body-small text-error">{getApiErrorMessage(activeQuery.error)}</p>
      ) : null}
      {activeSection === "축제성과" && performanceQuery.data ? (
        <PerformanceView report={performanceQuery.data} />
      ) : null}
      {activeSection === "방문객평가" && evaluationQuery.data ? (
        <EvaluationView key={festivalId} report={evaluationQuery.data} />
      ) : null}
    </div>
  );
}
