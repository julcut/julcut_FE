"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * 렌더 도중 잡히지 않은 예외가 났을 때 보여줄 화면.
 * 이 파일이 없으면 운영에서 Next.js 기본 오류 화면이 그대로 노출된다.
 */
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
      <h1 className="heading-small text-zinc-950">문제가 발생했습니다</h1>
      <p className="body-small text-center text-zinc-500">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
      </p>
      <Button type="button" onClick={() => unstable_retry()}>
        다시 시도
      </Button>
    </main>
  );
}
