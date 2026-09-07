export type FieldStaffStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface FieldStaff {
  staffId: string;
  loginId: string;
  name: string;
  phoneNumber: string;
  /**
   * 근무구역(근무부서). 백엔드 `FieldStaffResponse`에 아직 없는 필드라 지금은
   * 항상 undefined로 내려온다 — 백엔드가 컬럼을 추가하면 그대로 표시된다.
   */
  department?: string;
  validFrom: string;
  validUntil: string;
  status: FieldStaffStatus;
}

export interface CreateFieldStaffRequest {
  loginId: string;
  name: string;
  phoneNumber: string;
}

export interface CreateFieldStaffResult {
  staffId: string;
  loginId: string;
  name: string;
  phoneNumber: string;
  validFrom: string;
  validUntil: string;
  /** 최초 로그인용 임시 비밀번호 — 생성 응답에서만 내려온다. 이후에는 다시 조회할 수 없다. */
  temporaryPassword: string;
}

export interface UpdateFieldStaffRequest {
  name: string;
  phoneNumber: string;
}

export interface ReissueFieldStaffPasswordResponse {
  temporaryPassword: string;
}
