import axios from "axios";
import { useStaffAuthStore } from "@/store/staffAuthStore";

export const staffApiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

/** 로그인 화면 자체의 401(아이디/비밀번호 오류)은 그 화면에서 직접 안내하므로 리다이렉트 대상이 아니다. */
function isStaffScreen(pathname: string) {
  return pathname.startsWith("/staff") && !pathname.startsWith("/staff/login");
}

/**
 * 현장에서 세션이 만료되면 줄끝 갱신 같은 요청이 조용히 실패한다.
 * 401이면 스태프 세션을 지우고 만료 안내와 함께 로그인 화면으로 보낸다.
 */
staffApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 스태프 로그인에는 축제 ID가 필요하므로 세션을 지우기 전에 먼저 읽어 둔다.
      const expiredSession = useStaffAuthStore.getState().session;
      useStaffAuthStore.getState().clearSession();
      // 처음부터 로그인한 적 없는 경우(StaffAuthGuard의 최초 세션 조회 실패)는
      // 만료가 아니므로 가드가 하는 기존 이동에 맡긴다.
      if (
        expiredSession &&
        typeof window !== "undefined" &&
        isStaffScreen(window.location.pathname)
      ) {
        const params = new URLSearchParams({ expired: "1", festivalId: expiredSession.festivalId });
        window.location.replace(`/staff/login?${params.toString()}`);
      }
    }
    return Promise.reject(error);
  },
);
