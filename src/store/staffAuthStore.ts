import { create } from "zustand";
import type { StaffSession } from "@/features/auth/staff/types";

interface StaffAuthState {
  session: StaffSession | null;
  /**
   * 마지막으로 확인된 담당 축제 ID.
   *
   * 스태프 로그인은 축제 ID 없이는 제출조차 되지 않으므로(초대 링크 전용),
   * 로그아웃·세션 만료로 세션을 지운 뒤에도 이 값만은 남겨 두고 로그인 화면으로
   * 되돌려 보낼 때 다시 붙여 준다.
   */
  festivalId: string | null;
  setSession: (session: StaffSession) => void;
  /** 초대 링크로 들어온 축제 ID를 로그인 전에 기억해 둔다. */
  rememberFestivalId: (festivalId: string) => void;
  clearSession: () => void;
}

/** API 쿠키 세션에서 복구한 화면 표시용 상태이며 브라우저 저장소에는 기록하지 않는다. */
export const useStaffAuthStore = create<StaffAuthState>()((set) => ({
  session: null,
  festivalId: null,
  setSession: (session) => set({ session, festivalId: session.festivalId }),
  rememberFestivalId: (festivalId) => set({ festivalId }),
  clearSession: () => set({ session: null }),
}));
