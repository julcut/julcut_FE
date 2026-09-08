"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { TemporaryPasswordCard } from "@/components/ui/TemporaryPasswordCard";
import { getApiErrorMessage } from "@/lib/api/httpError";
import {
  getFieldStaff,
  reissueFieldStaffPassword,
  updateFieldStaff,
  updateFieldStaffStatus,
} from "./api";
import type { FieldStaffStatus } from "./types";

const STATUS_LABEL: Record<FieldStaffStatus, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  DELETED: "삭제됨",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

export function FieldStaffDetailPanel({
  festivalId,
  staffId,
}: {
  festivalId: string;
  staffId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reissueOpen, setReissueOpen] = useState(false);
  const staffQuery = useQuery({
    queryKey: ["field-staff", festivalId, staffId],
    queryFn: () => getFieldStaff(festivalId, staffId),
  });
  const staff = staffQuery.data;

  const invalidateStaff = () =>
    queryClient.invalidateQueries({ queryKey: ["field-staff", festivalId] });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!staff) return Promise.resolve();
      return updateFieldStaff(festivalId, staffId, {
        name: name ?? staff.name,
        /*
          백엔드는 근무구역이 생략되면 기존 값을 유지하고 빈 문자열이면 값을 지운다.
          입력을 건드리지 않았으면(null) 기존 값을 그대로 실어 보내 의도치 않은
          삭제를 막고, 사용자가 직접 비웠을 때만 빈 문자열이 나가 값이 지워진다.
        */
        department: department ?? staff.department ?? undefined,
        phoneNumber: phoneNumber ?? staff.phoneNumber,
      });
    },
    onSuccess: () => {
      toast.success("스태프 정보를 저장했습니다.");
      setName(null);
      setDepartment(null);
      setPhoneNumber(null);
      invalidateStaff();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "스태프 정보를 저장하지 못했습니다.")),
  });
  const statusMutation = useMutation({
    mutationFn: (active: boolean) => updateFieldStaffStatus(festivalId, staffId, active),
    onSuccess: (_result, active) => {
      toast.success(
        active
          ? "스태프 계정을 활성화했습니다."
          : "스태프 계정을 비활성화했습니다. 해당 스태프는 더 이상 로그인할 수 없습니다.",
      );
      setDeactivateOpen(false);
      invalidateStaff();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "상태를 변경하지 못했습니다.")),
  });
  const passwordMutation = useMutation({
    mutationFn: () => reissueFieldStaffPassword(festivalId, staffId),
    onSuccess: (result) => {
      toast.success("임시 비밀번호를 재발급했습니다.");
      setTemporaryPassword(result.temporaryPassword);
      setReissueOpen(false);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "임시 비밀번호를 재발급하지 못했습니다.")),
  });

  /** 직전 작업의 에러·임시 비밀번호가 다음 작업 결과와 섞여 보이지 않도록 먼저 지운다. */
  function resetActionResults() {
    setTemporaryPassword(null);
    updateMutation.reset();
    statusMutation.reset();
    passwordMutation.reset();
  }

  if (staffQuery.isLoading) {
    return <p className="body-regular text-zinc-500">불러오는 중...</p>;
  }

  if (staffQuery.isError) {
    return <p className="body-small text-error">{getApiErrorMessage(staffQuery.error)}</p>;
  }

  if (!staff) return null;

  const isActive = staff.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-4 rounded-lg border px-4 py-3">
      <dl className="flex flex-col gap-2">
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">이름</dt>
          <dd className="body-regular">{staff.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">로그인 ID</dt>
          <dd className="body-regular">{staff.loginId}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">근무구역</dt>
          <dd className="body-regular">{staff.department ?? "-"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">전화번호</dt>
          <dd className="body-regular">{staff.phoneNumber}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">유효 기간</dt>
          <dd className="body-regular">
            {formatDate(staff.validFrom)} ~ {formatDate(staff.validUntil)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="body-small w-24 text-zinc-500">상태</dt>
          <dd className="body-regular">{STATUS_LABEL[staff.status]}</dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="이름"
          value={name ?? staff.name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="근무구역"
          placeholder="근무구역"
          maxLength={100}
          value={department ?? staff.department ?? ""}
          onChange={(event) => setDepartment(event.target.value)}
        />
        <Input
          label="전화번호"
          value={phoneNumber ?? staff.phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={updateMutation.isPending}
          onClick={() => {
            resetActionResults();
            updateMutation.mutate();
          }}
        >
          정보 저장
        </Button>
        <Button
          variant="outline"
          disabled={statusMutation.isPending}
          onClick={() => {
            resetActionResults();
            // 비활성화는 해당 스태프가 로그인할 수 없게 되므로 먼저 확인받는다.
            if (isActive) {
              setDeactivateOpen(true);
              return;
            }
            statusMutation.mutate(true);
          }}
        >
          {isActive ? "비활성화" : "활성화"}
        </Button>
        <Button
          variant="outline"
          disabled={passwordMutation.isPending}
          onClick={() => {
            resetActionResults();
            setReissueOpen(true);
          }}
        >
          임시 비밀번호 재발급
        </Button>
      </div>
      {temporaryPassword ? (
        <TemporaryPasswordCard
          title={`${staff.name}(${staff.loginId}) 스태프의 임시 비밀번호가 재발급되었습니다.`}
          temporaryPassword={temporaryPassword}
          warning="임시 비밀번호는 지금만 확인할 수 있습니다. 스태프에게 바로 전달해주세요."
        />
      ) : null}
      {updateMutation.isError || statusMutation.isError || passwordMutation.isError ? (
        <p className="body-small text-error">
          {getApiErrorMessage(
            updateMutation.error ?? statusMutation.error ?? passwordMutation.error,
          )}
        </p>
      ) : null}

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="스태프 계정을 비활성화하시겠습니까?"
        description="비활성화하면 해당 스태프는 현장에서 로그인할 수 없습니다. 언제든 다시 활성화할 수 있습니다."
        confirmLabel="비활성화"
        onConfirm={() => statusMutation.mutate(false)}
        confirmPending={statusMutation.isPending}
      />

      <ConfirmDialog
        open={reissueOpen}
        onOpenChange={setReissueOpen}
        title="임시 비밀번호를 재발급하시겠습니까?"
        description="재발급하면 기존 비밀번호는 즉시 사용할 수 없습니다. 새 임시 비밀번호는 재발급 직후 한 번만 확인할 수 있습니다."
        confirmLabel="재발급"
        confirmVariant="primary"
        onConfirm={() => passwordMutation.mutate()}
        confirmPending={passwordMutation.isPending}
      />
    </div>
  );
}
