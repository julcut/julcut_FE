"use client";

import { useKakaoLoader } from "react-kakao-maps-sdk";

/**
 * 카카오맵 SDK 로더. 앱 전체가 같은 옵션으로 부르기 위한 공용 훅이다.
 *
 * SDK 로더는 한 번 호출된 옵션과 다른 옵션으로 다시 호출되면
 * "Loader must not be called again with different options"를 던진다.
 * 축제등록(주소 검색 때문에 services 필요)에서 부스맵으로 클라이언트 라우팅하면
 * 화면이 통째로 에러로 떨어졌던 이유가 이것이다. 옵션을 여기서만 정한다.
 */
export function useKakaoMapLoader() {
  return useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "",
    libraries: ["services"],
  });
}
