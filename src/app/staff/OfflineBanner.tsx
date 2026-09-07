"use client";

import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

const getSnapshot = () => navigator.onLine;
// 서버 렌더 시점에는 네트워크 상태를 알 수 없으므로 온라인으로 두고 마운트 후 갱신한다.
const getServerSnapshot = () => true;

/**
 * 축제장 네트워크가 끊겼을 때 화면 상단에 띄우는 배너.
 * 오프라인 상태에서는 줄끝 갱신 같은 요청이 전부 실패하므로 먼저 알려준다.
 */
export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-1.5 bg-point-600 px-5 py-2 text-white"
    >
      <ExclamationTriangleIcon className="size-4 shrink-0" />
      <p className="body-caption text-white">
        네트워크에 연결되어 있지 않습니다. 연결된 뒤 다시 시도해주세요.
      </p>
    </div>
  );
}
