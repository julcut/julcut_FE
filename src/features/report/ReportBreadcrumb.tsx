"use client";

import { CaretDownIcon } from "@radix-ui/react-icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** 결과리포트에서 전환 가능한 섹션. 브레드크럼 드롭다운 메뉴 항목과 1:1 대응한다. */
export const REPORT_SECTIONS = ["축제성과", "방문객평가"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/**
 * 설계서 2 / 2-1. shadcn 브레드크럼(Basic + Dropdown) 조합.
 * "결과리포트 > [축제성과 ▾]" 형태이고, 마지막 항목을 누르면
 * 축제성과 / 방문객평가 드롭다운 메뉴가 열린다.
 */
export function ReportBreadcrumb({
  section,
  onSectionChange,
}: {
  section: ReportSection;
  onSectionChange: (section: ReportSection) => void;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-zinc-500">결과리포트</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-sm text-zinc-950 outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400">
              {section}
              <CaretDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={section}
                onValueChange={(value) => onSectionChange(value as ReportSection)}
              >
                {REPORT_SECTIONS.map((item) => (
                  <DropdownMenuRadioItem key={item} value={item}>
                    {item}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
