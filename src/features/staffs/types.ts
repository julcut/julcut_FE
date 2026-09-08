export type FieldStaffStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export interface FieldStaff {
  staffId: string;
  loginId: string;
  name: string;
  phoneNumber: string;
  /** 근무구역(근무부서). 등록하지 않은 계정은 null로 내려온다. */
  department: string | null;
  validFrom: string;
  validUntil: string;
  status: FieldStaffStatus;
}

export interface CreateFieldStaffRequest {
  loginId: string;
  name: string;
  /** 근무구역. 생략하면 값 없이 만들어진다. 최대 100자. */
  department?: string;
  phoneNumber: string;
}

export interface CreateFieldStaffResult {
  staffId: string;
  loginId: string;
  name: string;
  department: string | null;
  phoneNumber: string;
  validFrom: string;
  validUntil: string;
  /** 최초 로그인용 임시 비밀번호 — 생성 응답에서만 내려온다. 이후에는 다시 조회할 수 없다. */
  temporaryPassword: string;
}

export interface UpdateFieldStaffRequest {
  name: string;
  /**
   * 근무구역. 생략하면 기존 값을 유지하고, 빈 문자열을 보내면 값을 지운다.
   * 값을 지울 의도가 없다면 반드시 기존 값을 그대로 실어 보내야 한다.
   */
  department?: string;
  phoneNumber: string;
}

export interface ReissueFieldStaffPasswordResponse {
  temporaryPassword: string;
}
