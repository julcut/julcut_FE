"use client";

import { CalendarIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FestivalOwnerBadge, OperatorBadge } from "@/components/ui/RoleBadge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatDday } from "@/features/festivals/dateFormat";
import { getApiErrorMessage } from "@/lib/api/httpError";
import { getManagedFestivals } from "./api";
import type { FestivalProgressStatus, FestivalSummary } from "./types";
import { canCreateFestival } from "@/features/auth/admin/types";
import { useAdminAuthStore } from "@/store/adminAuthStore";

const REGISTER_CTA_CLASSES =
  "inline-flex items-center justify-center gap-2.5 rounded-md bg-primary px-4 py-2 body-regular text-white transition-colors hover:bg-primary/90";

const STATUS_ORDER: FestivalProgressStatus[] = ["UPCOMING", "ONGOING", "COMPLETED"];

const STATUS_LABEL: Record<FestivalProgressStatus, string> = {
  UPCOMING: "진행 예정",
  ONGOING: "진행중",
  COMPLETED: "진행 완료",
};

const STATUS_HEADER_STYLES: Record<FestivalProgressStatus, string> = {
  UPCOMING: "bg-zinc-100",
  ONGOING: "bg-point-300",
  COMPLETED: "bg-secondary-300",
};

const STATUS_BODY_BORDER_STYLES: Record<FestivalProgressStatus, string> = {
  UPCOMING: "divide-zinc-200 border-zinc-200",
  ONGOING: "divide-point-600 border-point-600",
  COMPLETED: "divide-secondary-600 border-secondary-600",
};

/** 컬럼이 비었을 때 헤더 아래에 남는 빈 공백 대신 보여줄 안내 문구. */
const STATUS_EMPTY_MESSAGE: Record<FestivalProgressStatus, string> = {
  UPCOMING: "예정된 축제가 없습니다",
  ONGOING: "진행중인 축제가 없습니다",
  COMPLETED: "종료된 축제가 없습니다",
};

function formatFestivalDateRange(startDate: string, endDate: string) {
  const format = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return `${year}년 ${month}월 ${day}일`;
  };
  return `${format(startDate)} - ${format(endDate)}`;
}

/** 역할에 따라 축제 카드 클릭 시 이동할 경로. 총괄관리자는 축제관리, 운영자는 대시보드로 간다. */
function getFestivalHref(festival: FestivalSummary) {
  return festival.role === "FESTIVAL_OWNER"
    ? `/console/festivals/${festival.festivalId}`
    : `/console/festivals/${festival.festivalId}/dashboard`;
}

function FestivalCard({ festival }: { festival: FestivalSummary }) {
  return (
    <Link
      href={getFestivalHref(festival)}
      className="flex w-full min-w-0 flex-col gap-2 px-5 py-4 transition-colors hover:bg-zinc-50"
    >
      {/* 설계서상 역할 뱃지는 카드 우측 끝이 아니라 축제명 바로 옆에 붙는다. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="body-regular-bold min-w-0 wrap-anywhere text-zinc-950">
          {festival.festivalName}
        </p>
        <span className="shrink-0">
          {festival.role === "FESTIVAL_OWNER" ? <FestivalOwnerBadge /> : <OperatorBadge />}
        </span>
      </div>
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 shrink-0 text-zinc-600" />
          <p className="body-small text-zinc-600">
            {formatFestivalDateRange(festival.startDate, festival.endDate)}
          </p>
        </div>
        {festival.progressStatus === "UPCOMING" && (
          <Badge className="body-caption h-auto gap-[10px] rounded-full bg-zinc-100 px-2 py-1 text-zinc-950 hover:bg-zinc-100">
            <span className="size-[5px] shrink-0 rounded-full bg-zinc-950" />
            {formatDday(festival.startDate)}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function StatusColumn({
  status,
  festivals,
}: {
  status: FestivalProgressStatus;
  festivals: FestivalSummary[];
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div
        className={`heading-small flex gap-2 rounded-lg p-5 text-zinc-950 ${STATUS_HEADER_STYLES[status]}`}
      >
        <p>{STATUS_LABEL[status]}</p>
        <p>{festivals.length}</p>
      </div>
      {festivals.length > 0 ? (
        <div
          className={`flex flex-col divide-y overflow-hidden rounded-lg border ${STATUS_BODY_BORDER_STYLES[status]}`}
        >
          {festivals.map((festival) => (
            <FestivalCard key={festival.festivalId} festival={festival} />
          ))}
        </div>
      ) : (
        <Empty className="min-h-[96px] rounded-lg border border-dashed border-zinc-200 p-5">
          <EmptyHeader>
            <EmptyDescription className="body-small text-zinc-500">
              {STATUS_EMPTY_MESSAGE[status]}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

export function HomeFestivalBoard() {
  const accountKind = useAdminAuthStore((state) => state.session?.admin.accountKind);
  const canRegister = canCreateFestival(accountKind);
  const festivalsQuery = useQuery({
    queryKey: ["managed-festivals"],
    queryFn: getManagedFestivals,
  });

  if (festivalsQuery.isLoading) {
    return <p className="body-regular text-zinc-500">축제 목록을 불러오는 중...</p>;
  }

  if (festivalsQuery.isError) {
    return <p className="body-small text-error">{getApiErrorMessage(festivalsQuery.error)}</p>;
  }

  const festivals = festivalsQuery.data ?? [];
  if (festivals.length === 0) {
    return (
      <Empty className="min-h-[480px] rounded-none border-none p-0">
        <EmptyHeader>
          <EmptyTitle className="body-regular-bold text-zinc-950">
            등록된 축제가 없습니다
          </EmptyTitle>
          <EmptyDescription className="body-regular text-zinc-500">
            {canRegister
              ? "축제를 등록하고 관리해 보세요!"
              : "축제 총괄이 운영자로 초대하면 여기에 표시됩니다."}
          </EmptyDescription>
        </EmptyHeader>
        {canRegister ? (
          <EmptyContent>
            <Link href="/console/festivals/new" className={REGISTER_CTA_CLASSES}>
              축제 등록하기
            </Link>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  const festivalsByStatus = STATUS_ORDER.map((status) => ({
    status,
    festivals: festivals.filter((festival) => festival.progressStatus === status),
  }));

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
      {festivalsByStatus.map(({ status, festivals }) => (
        <StatusColumn key={status} status={status} festivals={festivals} />
      ))}
    </div>
  );
}
