"use client";

import { PersonIcon } from "@radix-ui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bottombar } from "@/components/ui/Bottombar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { TemporaryPasswordCard } from "@/components/ui/TemporaryPasswordCard";
import { getApiErrorMessage } from "@/lib/api/httpError";
import {
  assignSubAdmin,
  deleteSubAdmins,
  getSubAdmins,
  registerOperator,
  searchSubAdminCandidates,
} from "./api";
import type { RegisterOperatorResult, SubAdminCandidate } from "./types";

/** 검색 결과 아이템의 두 번째 줄 — 화면설계서상 "부서/직급". 둘 다 비면 줄을 그리지 않는다. */
function describeCandidate(candidate: SubAdminCandidate) {
  return [candidate.organization, candidate.rank].filter(Boolean).join(" · ");
}

export function OperatorsPanel({ festivalId }: { festivalId: string }) {
  const [keywordInput, setKeywordInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState<string | null>(null);
  // 검색 결과가 없을 때만 펼치는 보조 경로. 아직 관리자 계정이 없는 사람을 직접 등록한다.
  const [directFormOpen, setDirectFormOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [created, setCreated] = useState<RegisterOperatorResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const subAdminsQuery = useQuery({
    queryKey: ["sub-admins", festivalId],
    queryFn: () => getSubAdmins(festivalId),
  });

  const candidatesQuery = useQuery({
    queryKey: ["sub-admin-candidates", festivalId, searchKeyword],
    queryFn: () => searchSubAdminCandidates(festivalId, searchKeyword ?? ""),
    enabled: Boolean(searchKeyword),
  });

  const operators = subAdminsQuery.data ?? [];
  // 이미 배정된 운영자는 검색 결과에서 지운다(후보 API가 갱신되기 전 잠깐 남을 수 있다).
  const addedIds = new Set(operators.map((operator) => operator.adminId));
  const candidates = (candidatesQuery.data ?? []).filter(
    (candidate) => !addedIds.has(candidate.adminId),
  );
  const hasNoResult =
    Boolean(searchKeyword) && !candidatesQuery.isLoading && candidates.length === 0;

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

  function invalidateOperators() {
    queryClient.invalidateQueries({ queryKey: ["sub-admins", festivalId] });
    queryClient.invalidateQueries({ queryKey: ["sub-admin-candidates", festivalId] });
  }

  const assignMutation = useMutation({
    mutationFn: (candidate: SubAdminCandidate) => assignSubAdmin(festivalId, candidate.adminId),
    onSuccess: (_result, candidate) => {
      toast.success(`${candidate.name} 님을 운영자로 추가했습니다.`);
      invalidateOperators();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "운영자 추가에 실패했습니다.")),
  });

  const registerMutation = useMutation({
    mutationFn: () => registerOperator(festivalId, { email, name, companyName }),
    onSuccess: (result) => {
      setCreated(result);
      setEmail("");
      setName("");
      setCompanyName("");
      setDirectFormOpen(false);
      invalidateOperators();
      toast.success("운영자를 추가했습니다.", {
        description: result.temporaryPassword ? "아래 임시 비밀번호를 전달해 주세요." : undefined,
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "운영자 추가에 실패했습니다.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (adminIds: string[]) => deleteSubAdmins(festivalId, adminIds),
    onSuccess: (_data, adminIds) => {
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      toast.success(`운영자 ${adminIds.length}명을 삭제했습니다.`);
      invalidateOperators();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "운영자 삭제에 실패했습니다.")),
  });

  return (
    <div className="col-span-3">
      <div className="grid min-h-[calc(100vh-250px)] grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        <section className="col-span-1 flex min-w-0 flex-col gap-4 rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8">
          <p className="body-large-bold text-zinc-950">운영자 추가</p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setCreated(null);
              setDirectFormOpen(false);
              setSearchKeyword(keywordInput.trim() || null);
            }}
          >
            <Input
              layout="with-button"
              placeholder="이름 또는 이메일을 입력해 주세요"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              aria-label="운영자 검색"
              button={<Button type="submit">검색</Button>}
            />
          </form>

          {created?.created && created.temporaryPassword ? (
            <TemporaryPasswordCard
              title={`${created.name}(${created.email}) 계정이 생성되었습니다.`}
              temporaryPassword={created.temporaryPassword}
              warning="임시 비밀번호는 지금만 확인할 수 있습니다. 운영자에게 바로 전달해주세요."
            />
          ) : null}

          {created && !(created.created && created.temporaryPassword) ? (
            <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 px-4 py-3">
              <p className="body-small-bold text-zinc-950">
                {created.name}({created.email}) 계정을{" "}
                {created.created ? "생성했습니다." : "운영자로 추가했습니다."}
              </p>
            </div>
          ) : null}

          {searchKeyword === null && !created ? (
            <div className="rounded-lg bg-zinc-50 px-4 py-3">
              <p className="body-small text-zinc-950">
                이름이나 이메일로 검색해 운영자를 추가할 수 있어요.
              </p>
            </div>
          ) : null}

          {searchKeyword && candidatesQuery.isLoading ? (
            <p className="body-small text-zinc-500">검색 중...</p>
          ) : null}

          {candidatesQuery.isError ? (
            <p className="body-small text-error">{getApiErrorMessage(candidatesQuery.error)}</p>
          ) : null}

          {candidates.length > 0 ? (
            <ul className="flex flex-col">
              {candidates.map((candidate) => (
                <li
                  key={candidate.adminId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1 wrap-anywhere">
                    <p className="body-small text-zinc-950">
                      {candidate.name}({candidate.email})
                    </p>
                    {describeCandidate(candidate) ? (
                      <p className="body-small text-zinc-500">{describeCandidate(candidate)}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    disabled={assignMutation.isPending}
                    onClick={() => assignMutation.mutate(candidate)}
                  >
                    추가
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {hasNoResult && !directFormOpen ? (
            <div className="flex flex-col items-start gap-1">
              <p className="body-small text-zinc-500">검색 결과가 없습니다.</p>
              {/*
                설계서에는 없는 보조 경로다. 검색은 "이미 관리자 계정이 있는 사람"만
                찾을 수 있어서, 계정이 없는 외부업자는 이 폼으로 계정까지 만들어 준다.
              */}
              <Button variant="link" className="px-0" onClick={() => setDirectFormOpen(true)}>
                계정이 없는 운영자 직접 추가하기
              </Button>
            </div>
          ) : null}

          {directFormOpen ? (
            <form
              className="flex flex-col gap-4 border-t border-zinc-200 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                setCreated(null);
                registerMutation.mutate();
              }}
            >
              <p className="body-small-bold text-zinc-950">계정이 없는 운영자 직접 추가</p>
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

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDirectFormOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? "추가하는 중..." : "추가하기"}
                </Button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col rounded-lg border border-zinc-300 bg-white px-5 py-6 sm:px-8 xl:col-span-2">
          <div className="flex items-center gap-2 pb-4">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              disabled={operators.length === 0}
              aria-label="운영자 전체 선택"
            />
            <p className="body-large-bold text-zinc-950">
              전체 <span className="text-primary">{operators.length}</span>
            </p>
          </div>

          {subAdminsQuery.isLoading ? (
            <p className="body-regular py-4 text-zinc-500">불러오는 중...</p>
          ) : null}

          {subAdminsQuery.isError ? (
            <p className="body-small py-4 text-error">{getApiErrorMessage(subAdminsQuery.error)}</p>
          ) : null}

          {!subAdminsQuery.isLoading && operators.length === 0 ? (
            <p className="body-regular py-4 text-zinc-500">등록된 운영자가 없습니다.</p>
          ) : null}

          {operators.length > 0 ? (
            <div className="flex flex-col divide-y divide-zinc-200">
              {operators.map((operator) => (
                <label
                  key={operator.adminId}
                  className="flex cursor-pointer items-center gap-2 py-4"
                >
                  <Checkbox
                    checked={selectedIds.has(operator.adminId)}
                    onCheckedChange={() => toggleOne(operator.adminId)}
                    aria-label={`${operator.name} 선택`}
                  />
                  <PersonIcon className="size-4 shrink-0 text-secondary-600" />
                  <p className="body-regular wrap-anywhere text-zinc-950">
                    {operator.name}({operator.email})
                  </p>
                </label>
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
        title={`선택한 운영자 ${selectedIds.size}명을 삭제하시겠습니까?`}
        description="삭제한 운영자는 이 축제를 더 이상 관리할 수 없습니다."
        onConfirm={() => deleteMutation.mutate([...selectedIds])}
        confirmPending={deleteMutation.isPending}
      />
    </div>
  );
}
