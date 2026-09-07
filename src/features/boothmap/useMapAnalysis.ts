"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorCode } from "@/lib/api/httpError";
import { getMapAnalysisStatus } from "./api";
import type { MapAnalysisStatusResponse } from "./types";

/** 분석 상태를 다시 물어보는 주기. */
const POLL_INTERVAL_MS = 3000;

/**
 * 분석을 포기하고 안내로 전환하는 시각.
 *
 * OpenAI 호출 read timeout 90초에 재시도 3회, 거기에 워커가 대기열을 집어가는
 * 시간까지 더해지므로 3분은 정상 분석도 실패로 보이게 만든다. 넉넉히 7분을 준다.
 */
const ANALYSIS_TIMEOUT_MS = 7 * 60 * 1000;

/** 분석 작업이 아직 없다는 백엔드 응답 코드. 좌표 전용 지도에서는 이게 정상이다. */
const ANALYSIS_JOB_NOT_FOUND = 40406;

const ACTIVE_STATUSES = new Set(["PENDING", "PROCESSING"]);

export interface MapAnalysisState {
  /** 서버가 알려준 마지막 분석 상태. 작업 자체가 없으면 null. */
  status: MapAnalysisStatusResponse | null;
  /** 분석이 진행 중이라 편집·저장을 막아야 하는 상태. */
  isRunning: boolean;
  /** 진행 중 상태가 허용 시간을 넘겼다. */
  isTimedOut: boolean;
  /** 진행 중 상태가 이어진 시간(ms). 경과 시간 표시에 쓴다. */
  elapsedMs: number;
}

interface UseMapAnalysisOptions {
  festivalId: string;
  mapId: string | undefined;
  /** 분석이 방금 끝났을 때 호출된다. 작업 하나당 한 번이다. */
  onCompleted?: (status: MapAnalysisStatusResponse) => void;
}

/**
 * 배치도 AI 분석 진행 상태를 폴링한다.
 *
 * 예전 `analysisPolling.ts`의 `while(true)` 루프는 화면을 떠나도 멈출 수단이 없었다.
 * 이 프로젝트 표준인 TanStack Query `refetchInterval`로 대신하면 쿼리 구독이 사라질 때
 * 폴링도 함께 멈춘다.
 */
export function useMapAnalysis({
  festivalId,
  mapId,
  onCompleted,
}: UseMapAnalysisOptions): MapAnalysisState {
  const query = useQuery({
    queryKey: ["map-analysis", festivalId, mapId],
    queryFn: () => getMapAnalysisStatus(festivalId, mapId!),
    enabled: !!mapId,
    // 작업이 없으면 404가 확정이라 재시도가 의미 없다. 좌표 전용 지도의 정상 상태다.
    retry: false,
    refetchInterval: (activeQuery) => {
      const status = activeQuery.state.data?.status;
      return status && ACTIVE_STATUSES.has(status) ? POLL_INTERVAL_MS : false;
    },
  });

  const jobNotFound = getApiErrorCode(query.error) === ANALYSIS_JOB_NOT_FOUND;
  const status = jobNotFound ? null : (query.data ?? null);
  const isActive = !!status && ACTIVE_STATUSES.has(status.status);
  const activeJobId = isActive ? status.jobId : null;

  // 경과 시간 계산. React 컴파일러 규칙상 이펙트 본문에서 곧바로 setState 할 수 없으므로,
  // 시각은 오직 1초 타이머 콜백 안에서만 갱신한다. 그래서 첫 1초는 "0초"로 보인다.
  const [nowTick, setNowTick] = useState(0);
  const [runStart, setRunStart] = useState<{ jobId: string; at: number } | null>(null);
  useEffect(() => {
    if (activeJobId === null) return;
    const timer = window.setInterval(() => {
      const at = Date.now();
      setRunStart((previous) =>
        previous?.jobId === activeJobId ? previous : { jobId: activeJobId, at },
      );
      setNowTick(at);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeJobId]);

  // 서버가 알려준 시작 시각을 우선 쓴다 — 새로고침해도 경과 시간이 이어진다.
  // 아직 PENDING이라 시작 시각이 없으면 이 화면이 작업을 처음 본 시각으로 잰다.
  const serverStartedAt = status?.startedAt ? Date.parse(status.startedAt) : Number.NaN;
  const startedAt = Number.isNaN(serverStartedAt)
    ? runStart !== null && runStart.jobId === activeJobId
      ? runStart.at
      : null
    : serverStartedAt;
  const elapsedMs =
    isActive && startedAt !== null && nowTick > 0 ? Math.max(0, nowTick - startedAt) : 0;
  const isTimedOut = isActive && elapsedMs > ANALYSIS_TIMEOUT_MS;

  // 완료 알림은 작업 하나당 한 번만 보낸다 — 폴링이 같은 응답을 계속 돌려주기 때문이다.
  const notifiedJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!status || status.status !== "COMPLETED") return;
    if (notifiedJobIdRef.current === status.jobId) return;
    notifiedJobIdRef.current = status.jobId;
    onCompleted?.(status);
  }, [status, onCompleted]);

  return {
    status,
    isRunning: isActive && !isTimedOut,
    isTimedOut,
    elapsedMs,
  };
}
