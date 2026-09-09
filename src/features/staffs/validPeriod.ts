/** 스태프 계정 유효 기간 표기. 값이 날짜로 읽히지 않으면 원문을 그대로 보여준다. */
export function formatStaffDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

/**
 * 스태프 계정이 로그인할 수 있는 기간 안내 문구.
 *
 * 계정을 만들어도 축제 시작 7일 전이 되기 전에는 로그인할 수 없어서, 생성 직후
 * 임시 비밀번호만 전달하면 "비밀번호가 틀렸다"는 문의로 돌아온다.
 */
export function staffLoginPeriodNotice(validFrom: string, validUntil: string): string {
  return `로그인 가능 기간: ${formatStaffDate(validFrom)} ~ ${formatStaffDate(validUntil)} (축제 시작 7일 전부터 로그인할 수 있습니다)`;
}
