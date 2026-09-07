"use client";

import { ChevronDownIcon, StarFilledIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { getFestivalReportEvaluation, getFestivalReportPerformance } from "./api";
import type {
  FestivalReportEvaluation,
  FestivalReportPerformance,
  FestivalReportTextSummary,
} from "./types";

type ReportSection = "축제성과" | "방문객평가";

function SummaryCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-4">
      <p className="body-small-bold text-zinc-950">{label}</p>
      <p className="heading-small text-zinc-950">{value}</p>
      {helper ? <p className="body-caption text-secondary-600">{helper}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5">
      <h2 className="body-small-bold text-zinc-950">{title}</h2>
      <div className="mt-5">{children}</div>
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

function PerformanceView({ report }: { report: FestivalReportPerformance }) {
  if (!report.performanceAvailable)
    return <EmptyState message="아직 제공할 수 있는 축제 성과 데이터가 없습니다." />;
  const { metrics } = report;
  const visitors = metrics.totalVisitors;
  const directionLabel =
    visitors.direction === "DOWN" ? "감소" : visitors.direction === "FLAT" ? "변동 없음" : "증가";
  return (
    <>
      <h1 className="heading-small text-zinc-950">
        {visitors.changeRatePercent === null
          ? `${metrics.festivalName}의 성과를 확인해 보세요.`
          : `이전 축제보다 방문객이 ${Math.abs(visitors.changeRatePercent).toLocaleString()}% ${directionLabel}${visitors.direction === "FLAT" ? "입니다" : "했습니다"}`}
      </h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="총 관광객수"
          value={`${visitors.current.toLocaleString()} 명`}
          helper={
            visitors.previous === null
              ? "비교할 이전 축제 데이터가 없습니다."
              : `이전 축제 대비 ${Math.abs(visitors.delta ?? 0).toLocaleString()}명 ${directionLabel}`
          }
        />
        <SummaryCard
          label="경제효과"
          value={
            metrics.economicEffect.available && metrics.economicEffect.totalMillionKrw !== null
              ? `${metrics.economicEffect.totalMillionKrw.toLocaleString()} 백만원`
              : "데이터 미제공"
          }
        />
        <SummaryCard
          label="운영효율(평균 대기시간)"
          value={
            metrics.operationEfficiency.available &&
            metrics.operationEfficiency.averageWaitMinutes !== null
              ? `${metrics.operationEfficiency.averageWaitMinutes.toLocaleString()} 분`
              : "데이터 미제공"
          }
          helper={
            metrics.operationEfficiency.available
              ? `참여부스 ${metrics.operationEfficiency.boothCount.toLocaleString()}개`
              : undefined
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="일자별 관광객 추이">
          <VisitorTrend data={metrics.dailyTrend} />
        </Panel>
        <Panel title="방문 집중 시간대">
          {metrics.visitPattern.available && metrics.visitPattern.peakHours.length ? (
            <div className="flex flex-wrap gap-2">
              {metrics.visitPattern.peakHours.map((hour) => (
                <span
                  key={hour}
                  className="rounded-full bg-primary-300 px-3 py-1 body-small text-zinc-950"
                >
                  {hour}
                </span>
              ))}
            </div>
          ) : (
            <p className="body-small text-zinc-400">시간대별 데이터가 없습니다.</p>
          )}
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="구역별 평균 대기시간">
          {metrics.zoneWaitRanking.length ? (
            <ol className="flex flex-col gap-3">
              {metrics.zoneWaitRanking.map((zone) => (
                <li
                  key={`${zone.rank}-${zone.zoneName}`}
                  className="flex justify-between body-small"
                >
                  <span>
                    {zone.rank}. {zone.zoneName}
                  </span>
                  <span className="body-small-bold">{zone.averageWaitMinutes}분</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="body-small text-zinc-400">구역별 데이터가 없습니다.</p>
          )}
        </Panel>
        <Panel title="부스 혼잡도 비율">
          {metrics.boothCongestionShare.length ? (
            <div className="flex flex-col gap-3">
              {metrics.boothCongestionShare.map((item) => (
                <div key={item.congestionLevel}>
                  <div className="mb-1 flex justify-between body-small">
                    <span>{item.congestionLevel}</span>
                    <span>{item.sharePercent}%</span>
                  </div>
                  <div className="h-3 rounded bg-zinc-100">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, item.sharePercent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="body-small text-zinc-400">혼잡도 데이터가 없습니다.</p>
          )}
        </Panel>
      </div>
      <TextSummary summary={report.ai.performanceSummary} />
    </>
  );
}

function EvaluationView({ report }: { report: FestivalReportEvaluation }) {
  if (!report.evaluationAvailable || !report.reviews.available)
    return <EmptyState message="아직 제공할 수 있는 방문객 평가 데이터가 없습니다." />;
  const reviews = report.reviews.featuredReviews.length
    ? report.reviews.featuredReviews
    : report.reviews.reviews;
  return (
    <>
      <h1 className="heading-small text-zinc-950">방문객이 남긴 평가를 확인해 보세요.</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="평균 별점"
          value={
            report.reviews.averageScore === null
              ? "데이터 미제공"
              : `${report.reviews.averageScore.toFixed(1)} / 5.0`
          }
          helper={
            report.reviews.scoreDelta === null
              ? undefined
              : `이전 축제 대비 ${report.reviews.scoreDelta >= 0 ? "+" : ""}${report.reviews.scoreDelta.toFixed(1)}점`
          }
        />
        <SummaryCard label="리뷰 수" value={`${report.reviews.reviewCount.toLocaleString()} 개`} />
        <SummaryCard
          label="종합 감성"
          value={
            report.ai.headlineSentiment === "NONE" ? "분석 결과 없음" : report.ai.headlineSentiment
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="별점 분포">
          <div className="flex flex-col gap-3">
            {[...report.reviews.ratingDistribution]
              .sort((a, b) => b.rating - a.rating)
              .map((item) => {
                const ratio = item.ratio <= 1 ? item.ratio * 100 : item.ratio;
                return (
                  <div
                    key={item.rating}
                    className="grid grid-cols-[48px_1fr_52px] items-center gap-3 body-small"
                  >
                    <span className="flex items-center gap-1">
                      {item.rating}
                      <StarFilledIcon className="text-point-600" />
                    </span>
                    <div className="h-3 rounded bg-zinc-100">
                      <div
                        className="h-full rounded bg-point-600"
                        style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                      />
                    </div>
                    <span className="text-right text-zinc-500">{item.count}개</span>
                  </div>
                );
              })}
          </div>
        </Panel>
        <Panel title="주요 키워드">
          <div className="flex flex-col gap-5">
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
      <Panel title="방문객 리뷰">
        {reviews.length ? (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {reviews.map((review, index) => (
              <li
                key={review.reviewId ?? `${review.displayName}-${index}`}
                className="rounded-lg bg-zinc-50 p-4"
              >
                <div className="mb-2 flex justify-between body-small-bold">
                  <span>{review.displayName}</span>
                  {review.rating === null ? null : (
                    <span className="flex items-center gap-1">
                      {review.rating}
                      <StarFilledIcon className="text-point-600" />
                    </span>
                  )}
                </div>
                <p className="body-small text-zinc-600">{review.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-small text-zinc-400">표시할 리뷰가 없습니다.</p>
        )}
      </Panel>
      <TextSummary summary={report.ai.summary} />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [menuOpen]);

  return (
    <div id="festival-performance" className="flex flex-col gap-6">
      <div ref={menuRef} className="relative flex items-center gap-2 body-small text-zinc-500">
        <span>결과리포트</span>
        <span>&gt;</span>
        <button
          type="button"
          className="flex items-center gap-1 text-zinc-950"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {activeSection}
          <ChevronDownIcon />
        </button>
        {menuOpen ? (
          <div className="absolute top-7 left-20 z-10 flex w-32 flex-col rounded-md border border-zinc-200 bg-white py-1 shadow-sm">
            {(["축제성과", "방문객평가"] as const).map((section) => (
              <button
                key={section}
                type="button"
                className={`body-small px-3 py-2 text-left text-zinc-950 hover:bg-zinc-100 ${activeSection === section ? "bg-zinc-100" : ""}`}
                onClick={() => {
                  setActiveSection(section);
                  setMenuOpen(false);
                }}
              >
                {section}
              </button>
            ))}
          </div>
        ) : null}
      </div>
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
        <EvaluationView report={evaluationQuery.data} />
      ) : null}
    </div>
  );
}
