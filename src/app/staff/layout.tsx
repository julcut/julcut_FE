import { StaffHeader } from "@/components/layout/StaffHeader";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "./OfflineBanner";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[402px] flex-1 flex-col bg-white">
      <StaffHeader />
      <OfflineBanner />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {/* 모바일 화면이라 콘솔(top-right)과 달리 상단 중앙에 띄운다. */}
      <Toaster position="top-center" />
    </div>
  );
}
