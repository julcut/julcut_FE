"use client";

import { useCallback, useState } from "react";

/**
 * 히스토리에 쌓아 둘 스냅샷 최대 개수.
 *
 * 스냅샷 하나가 편집 상태 전체(부스·구역·삭제 목록)를 직렬화한 문자열이라
 * 부스가 많으면 개당 수십 KB까지 커진다. 200개 규모 축제를 기준으로 잡아도
 * 50개면 1MB 안팎이라 메모리 부담이 없고, 실제 편집에서 50번을 거슬러
 * 올라가는 일은 드물어 이 값으로 상한을 둔다.
 */
const MAX_HISTORY_SIZE = 50;

interface HistoryState {
  /** 기준선 키. 서버 데이터로 상태를 다시 채우면 값이 바뀌고 히스토리도 초기화된다. */
  baselineKey: string;
  /** 오래된 것부터 쌓인 스냅샷 목록. */
  entries: string[];
  /** 지금 화면에 반영돼 있는 스냅샷의 위치. */
  index: number;
}

export interface EditHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/**
 * 직렬화된 편집 스냅샷을 스택에 쌓아 실행취소/다시실행을 제공한다.
 *
 * `snapshot`이 직전에 기록해 둔 값과 달라지면 렌더 도중 스택에 밀어 넣는다.
 * 되돌리기는 포인터(`index`)를 옮기면서 `onRestore`로 그 시점 스냅샷을 넘기고,
 * 호출자가 복원한 결과는 다시 같은 문자열이 되므로 "달라졌다" 조건에 걸리지
 * 않는다. 복원 때문에 다시 push되는 무한 루프가 여기서 막힌다 — 복원 여부를
 * 따로 기억하는 플래그가 필요 없다.
 *
 * @param baselineKey 기준선 식별자. `null`이면 아직 초기화 전이라 기록하지 않는다.
 * @param snapshot 현재 편집 상태를 직렬화한 문자열.
 * @param onRestore 되돌아갈 스냅샷을 화면 상태로 되돌리는 콜백.
 */
export function useEditHistory({
  baselineKey,
  snapshot,
  onRestore,
}: {
  baselineKey: string | null;
  snapshot: string;
  onRestore: (snapshot: string) => void;
}): EditHistory {
  const [history, setHistory] = useState<HistoryState | null>(null);

  if (baselineKey !== null && history?.baselineKey !== baselineKey) {
    // 기준선이 바뀌었다(첫 로딩·지도 교체·AI 분석 완료·저장 직후).
    // 그 이전으로 되돌리면 서버에 없는 상태로 돌아가므로 기록을 비운다.
    setHistory({ baselineKey, entries: [snapshot], index: 0 });
  } else if (history !== null && history.entries[history.index] !== snapshot) {
    // 새 편집이 일어났다. 되돌린 뒤 새로 편집한 경우 앞쪽(다시실행) 기록은 버린다.
    const entries = [...history.entries.slice(0, history.index + 1), snapshot];
    const overflow = Math.max(entries.length - MAX_HISTORY_SIZE, 0);
    setHistory({
      baselineKey: history.baselineKey,
      entries: entries.slice(overflow),
      index: entries.length - 1 - overflow,
    });
  }

  const canUndo = history !== null && history.index > 0;
  const canRedo = history !== null && history.index < history.entries.length - 1;

  const undo = useCallback(() => {
    if (history === null || history.index <= 0) return;
    const nextIndex = history.index - 1;
    setHistory({ ...history, index: nextIndex });
    onRestore(history.entries[nextIndex]);
  }, [history, onRestore]);

  const redo = useCallback(() => {
    if (history === null || history.index >= history.entries.length - 1) return;
    const nextIndex = history.index + 1;
    setHistory({ ...history, index: nextIndex });
    onRestore(history.entries[nextIndex]);
  }, [history, onRestore]);

  return { canUndo, canRedo, undo, redo };
}
