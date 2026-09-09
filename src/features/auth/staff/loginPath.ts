/**
 * 스태프 로그인 화면 경로.
 *
 * 스태프 로그인 폼은 담당 축제 ID가 없으면 제출 자체를 막는다(초대 링크 전용).
 * 그래서 로그아웃·미인증·세션 만료 어느 경로로 되돌려 보내든 알고 있는 축제 ID를
 * 반드시 함께 실어 준다. 이 함수를 거치지 않고 "/staff/login"으로 직접 보내면
 * 다시 로그인할 수 없는 화면이 된다.
 */
export function staffLoginPath({
  festivalId,
  expired = false,
}: {
  festivalId?: string | null;
  expired?: boolean;
} = {}): string {
  const params = new URLSearchParams();
  if (festivalId) params.set("festivalId", festivalId);
  if (expired) params.set("expired", "1");
  const query = params.toString();
  return query ? `/staff/login?${query}` : "/staff/login";
}
