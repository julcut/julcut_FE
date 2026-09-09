import { create } from "zustand";

interface ConsoleUiState {
  /** true면 콘솔 상단 Nav 탭 줄을 숨긴다(예: 방문인원 입력/분석 중 화면). */
  hideNav: boolean;
  setHideNav: (hideNav: boolean) => void;
  /** true면 콘텐츠 영역의 좌우/상하 여백을 없애 화면 전체를 채운다(예: 대시보드 지도). */
  fullBleed: boolean;
  setFullBleed: (fullBleed: boolean) => void;
  /**
   * true면 알림을 오른쪽 위 액션 바 아래로 내린다.
   *
   * 부스맵 편집기처럼 오른쪽 위에 «저장하기»를 띄우는 화면은 알림이 그 버튼을 덮어
   * 클릭까지 막았다. 알림 자리 자체는 화면마다 흔들리면 안 되므로, 액션 바가 있는
   * 화면만 이 값을 켠다.
   */
  toastBelowActionBar: boolean;
  setToastBelowActionBar: (toastBelowActionBar: boolean) => void;
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  hideNav: false,
  setHideNav: (hideNav) => set({ hideNav }),
  fullBleed: false,
  setFullBleed: (fullBleed) => set({ fullBleed }),
  toastBelowActionBar: false,
  setToastBelowActionBar: (toastBelowActionBar) => set({ toastBelowActionBar }),
}));
