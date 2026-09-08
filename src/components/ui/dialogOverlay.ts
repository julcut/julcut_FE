/**
 * 모달 딤 오버레이 공통 클래스.
 *
 * 콘솔 화면의 딤은 상단바(헤더+네비)를 가리지 않는 것이 디자인 스펙이라
 * 상단바 높이만큼 아래에서 시작한다. 예전에는 이 값을 `top-[118px]`로
 * 세 곳에 복제해 두었는데, 네비가 숨겨지는 화면(결과리포트)이나 네비가
 * 줄바꿈되는 좁은 화면에서 딤 위치가 어긋났다. 이제 `HeaderNav`가 자기
 * 높이를 `--console-topbar-height`에 실어 주고 여기서 그 값을 읽는다.
 * 상단바가 없는 화면에서는 기본값 0으로 화면 전체를 덮는다.
 */
export const DIALOG_OVERLAY_CLASSES =
  "fixed inset-x-0 top-[var(--console-topbar-height,0px)] bottom-0 z-30 bg-dimmed";
