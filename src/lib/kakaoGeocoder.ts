"use client";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * 주소 문자열을 좌표로 바꾼다(지오코딩). 찾지 못하면 null.
 *
 * 카카오맵 SDK의 services 라이브러리를 쓴다. `useKakaoMapLoader`가 이미
 * `libraries: ["services"]`로 SDK를 올리고 있어 로더 옵션은 손대지 않는다
 * (옵션을 다르게 부르면 SDK가 "Loader must not be called again with different
 * options"를 던져 화면이 통째로 죽는다).
 *
 * 축제 등록은 위경도가 없으면 백엔드 검증에 걸리고 부스맵도 만들 수 없다.
 * 주소 검색으로 고른 주소는 좌표가 함께 오지만, 직접 입력한 주소나 이전 축제에서
 * 불러온 주소는 좌표가 비어 있어 이 함수로 채워야 한다.
 */
export function geocodeAddress(address: string): Promise<Coordinate | null> {
  const keyword = address.trim();
  if (keyword.length === 0) return Promise.resolve(null);
  // SDK가 아직 안 올라왔으면 좌표를 만들 수 없다. 호출부가 "못 찾음"과 같게 다룬다.
  if (typeof kakao === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let geocoder: kakao.maps.services.Geocoder;
    try {
      geocoder = new kakao.maps.services.Geocoder();
    } catch {
      resolve(null);
      return;
    }

    geocoder.addressSearch(keyword, (data, status) => {
      if (status !== kakao.maps.services.Status.OK || data.length === 0) {
        resolve(null);
        return;
      }
      const [first] = data;
      const latitude = Number(first.y);
      const longitude = Number(first.x);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        resolve(null);
        return;
      }
      resolve({ latitude, longitude });
    });
  });
}
