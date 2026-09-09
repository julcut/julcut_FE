import { StaffHeader } from "@/components/layout/StaffHeader";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "./OfflineBanner";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[402px] flex-1 flex-col bg-white">
      <StaffHeader />
      <OfflineBanner />
      {/* 스태프 화면 기본 여백은 20이다. 지도처럼 꽉 채워야 하는 화면만 안에서 되돌린다. */}
      <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>
      {/* 모바일 화면이라 콘솔(top-right)과 달리 상단 중앙에 띄운다. */}
      {/* 스태프 화면은 상단 요약바가 얇아 헤더 아래로만 살짝 내린다. */}
      <Toaster position="top-center" offset={{ top: "76px" }} mobileOffset={{ top: "68px" }} />
    </div>
  );
}
