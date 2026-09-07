"use client";

import { PersonIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/Input";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { deleteSubAdmins, getSubAdmins, registerOperator } from "./api";
import type { RegisterOperatorResult } from "./types";

export function OperatorsPanel({ festivalId }: { festivalId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [created, setCreated] = useState<RegisterOperatorResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const subAdminsQuery = useQuery({
    queryKey: ["sub-admins", festivalId],
    queryFn: () => getSubAdmins(festivalId),
  });

  const operators = subAdminsQuery.data ?? [];
  const allSelected = operators.length > 0 && selectedIds.size === operators.length;

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(operators.map((operator) => operator.adminId)),
    );
  }

  function toggleOne(adminId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(adminId)) {
        next.delete(adminId);
      } else {
        next.add(adminId);
      }
      return next;
    });
  }

  const registerMutation = useMutation({
    mutationFn: () => registerOperator(festivalId, { email, name, companyName }),
    onSuccess: (result) => {
      setCreated(result);
      setEmail("");
      setName("");
      setCompanyName("");
      queryClient.invalidateQueries({ queryKey: ["sub-admins", festivalId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (adminIds: string[]) => deleteSubAdmins(festivalId, adminIds),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["sub-admins", festivalId] });
    },
  });

  return (
    <div className="col-span-3 flex flex-col gap-4">
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="col-span-1 flex min-w-0 flex-col gap-4 rounded-lg border border-zinc-300 bg-white p-6">
          <p className="body-large-bold text-zinc-950">운영자 추가</p>

          {created ? (
            <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 px-4 py-3">
              {created.created ? (
                <>
                  <p className="body-small-bold text-zinc-950">
                    {created.name}({created.email}) 계정이 생성되었습니다.
                  </p>
                  {created.temporaryPassword ? (
                    <p className="body-small text-zinc-950">
                      임시 비밀번호: <span className="font-mono">{created.temporaryPassword}</span>
                    </p>
                  ) : null}
                  <p className="body-caption text-zinc-500">
                    임시 비밀번호는 지금만 확인할 수 있습니다. 운영자에게 바로 전달해주세요.
                  </p>
                </>
              ) : (
                <p className="body-small-bold text-zinc-950">
                  {created.name}({created.email}) 계정을 운영자로 추가했습니다.
                </p>
              )}
            </div>
          ) : null}

          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setCreated(null);
              registerMutation.mutate();
            }}
          >
            <Input
              type="email"
              required
              label="이메일"
              placeholder="이메일"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              required
              minLength={2}
              maxLength={100}
              label="이름"
              placeholder="이름"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              required
              minLength={2}
              maxLength={255}
              label="업체명"
              placeholder="업체명"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />

            {registerMutation.isError ? (
              <p className="body-caption text-error">
                {getApiErrorMessage(registerMutation.error)}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "추가하는 중..." : "추가하기"}
              </Button>
            </div>
          </form>
        </div>

        <div className="flex min-w-0 flex-col xl:col-span-2 rounded-lg border border-zinc-300 bg-white">
          <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={operators.length === 0}
            />
            <p className="body-regular-bold text-zinc-950">
              전체 <span className="text-primary">{operators.length}</span>
            </p>
          </div>

          {subAdminsQuery.isLoading ? (
            <p className="body-regular p-6 text-zinc-500">불러오는 중...</p>
          ) : null}

          {subAdminsQuery.isError ? (
            <p className="body-small p-6 text-error">{getApiErrorMessage(subAdminsQuery.error)}</p>
          ) : null}

          {!subAdminsQuery.isLoading && operators.length === 0 ? (
            <p className="body-regular p-6 text-zinc-500">등록된 운영자가 없습니다.</p>
          ) : null}

          {operators.length > 0 ? (
            <div className="flex flex-col divide-y divide-zinc-200">
              {operators.map((operator) => (
                <label
                  key={operator.adminId}
                  className="flex cursor-pointer items-center gap-3 px-6 py-4"
                >
                  <Checkbox
                    checked={selectedIds.has(operator.adminId)}
                    onCheckedChange={() => toggleOne(operator.adminId)}
                  />
                  <PersonIcon className="size-4 shrink-0 text-zinc-400" />
                  <div className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
                    <p className="body-regular-bold text-zinc-950">
                      {operator.name}
                      <span className="body-small font-normal text-zinc-500">
                        ({operator.email})
                      </span>
                    </p>
                    {operator.organization ? (
                      <p className="body-caption text-zinc-500">{operator.organization}</p>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
          <p className="body-small text-zinc-950">
            <span className="body-small-bold text-primary">{selectedIds.size}</span>개 선택됨
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate([...selectedIds])}
          >
            삭제하기
          </Button>
        </div>
      ) : null}
    </div>
  );
}
