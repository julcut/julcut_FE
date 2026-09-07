"use client";

import { PersonIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Bottombar } from "@/components/ui/Bottombar";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { createFieldStaff, deleteFieldStaffBulk, getFieldStaffList } from "./api";

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
}

export function StaffsPanel({ festivalId }: { festivalId: string }) {
  const queryClient = useQueryClient();
  const [loginId, setLoginId] = useState(() => `staff-${crypto.randomUUID().slice(0, 8)}`);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const staffListQuery = useQuery({
    queryKey: ["field-staff", festivalId],
    queryFn: () => getFieldStaffList(festivalId),
  });
  const staffList = staffListQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createFieldStaff(festivalId, { loginId, name, phoneNumber }),
    onSuccess: () => {
      setName("");
      setPhoneNumber("");
      setLoginId(`staff-${crypto.randomUUID().slice(0, 8)}`);
      queryClient.invalidateQueries({ queryKey: ["field-staff", festivalId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (staffIds: string[]) => deleteFieldStaffBulk(festivalId, staffIds),
    onSuccess: () => {
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["field-staff", festivalId] });
    },
  });

  const allSelected = staffList.length > 0 && selectedIds.size === staffList.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(staffList.map((staff) => staff.staffId)));
  }

  function toggleOne(staffId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  }

  return (
    <div className="col-span-3">
      <div className="grid min-h-[calc(100vh-250px)] grid-cols-1 xl:grid-cols-3 items-stretch gap-6">
        <section className="col-span-1 flex min-w-0 flex-col gap-4 rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8">
          <p className="body-large-bold text-zinc-950">스태프 추가</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <Input
              label="이름"
              placeholder="이름"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
            <Input
              label="아이디"
              disabled
              value={loginId}
              helperText="아이디는 자동으로 생성됩니다"
            />
            <Input
              label="전화번호"
              placeholder="전화번호"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
              required
              maxLength={13}
              pattern="^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$"
              title="예: 010-1234-5678"
            />

            {createMutation.isError ? (
              <p className="body-caption text-error">{getApiErrorMessage(createMutation.error)}</p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "추가하는 중..." : "추가하기"}
              </Button>
            </div>
          </form>
        </section>

        <section className="xl:col-span-2 flex min-w-0 flex-col rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8">
          <div className="flex items-center gap-2 pb-4">
            <Checkbox
              className="border-zinc-200 data-[state=checked]:border-point-600 data-[state=checked]:bg-point-600"
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={staffList.length === 0}
            />
            <p className="body-large-bold text-zinc-950">
              전체 <span className="text-primary">{staffList.length}</span>
            </p>
          </div>

          {staffListQuery.isLoading ? (
            <p className="body-regular py-4 text-zinc-500">불러오는 중...</p>
          ) : null}

          {staffListQuery.isError ? (
            <p className="body-small py-4 text-error">{getApiErrorMessage(staffListQuery.error)}</p>
          ) : null}

          {!staffListQuery.isLoading && staffList.length === 0 ? (
            <p className="body-regular py-4 text-zinc-500">등록된 스태프가 없습니다.</p>
          ) : null}

          {staffList.length > 0 ? (
            <div className="flex flex-col divide-y divide-zinc-200">
              {staffList.map((staff) => (
                <div key={staff.staffId} className="flex items-start gap-2 py-4">
                  <Checkbox
                    className="mt-1 border-zinc-200 data-[state=checked]:border-point-600 data-[state=checked]:bg-point-600"
                    checked={selectedIds.has(staff.staffId)}
                    onCheckedChange={() => toggleOne(staff.staffId)}
                    aria-label={`${staff.name} 선택`}
                  />
                  <Link
                    href={`/console/festivals/${festivalId}/staffs/${staff.staffId}`}
                    className="flex min-w-0 flex-col gap-1"
                  >
                    <div className="flex items-center gap-1">
                      <PersonIcon className="size-4 shrink-0 text-point-600" />
                      <p className="body-regular wrap-anywhere text-zinc-950 hover:underline">
                        {staff.name}({formatPhoneNumber(staff.phoneNumber)})
                      </p>
                    </div>
                    <p className="body-small wrap-anywhere pl-4 text-zinc-500">{staff.loginId}</p>
                  </Link>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {selectedIds.size > 0 ? (
        <Bottombar
          type="selected"
          count={selectedIds.size}
          deleteDisabled={deleteMutation.isPending}
          onDelete={() => setDeleteDialogOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="선택한 스태프를 삭제하시겠습니까?"
        description="삭제한 스태프 계정으로는 더 이상 로그인할 수 없습니다."
        onConfirm={() => deleteMutation.mutate([...selectedIds])}
        confirmPending={deleteMutation.isPending}
      />
    </div>
  );
}
