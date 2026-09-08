/** 지도에 부스가 꽉 차 보이도록 맞출 때 남길 화면 여백(px). */
const FIT_PADDING = 56;

interface FittablePoint {
  lat: number;
  lng: number;
}

/**
 * 부스 전체가 화면에 들어오도록 지도 범위를 맞춘다.
 *
 * 배율을 고정값으로 두면 축제 규모에 따라 결과가 갈린다. 부스가 78m 안에 몰린
 * 축제는 너무 멀어 점 하나로 뭉쳐 보이고, 270m로 퍼진 축제는 양끝이 화면 밖으로
 * 나간다. 그래서 분포에 맞춰 맞춘다.
 *
 * 부스가 하나뿐이면 범위가 한 점이라 배율이 최대까지 튀므로 그때는 맞추지 않는다.
 */
export function fitBoothBounds(map: kakao.maps.Map | null, points: FittablePoint[]) {
  if (!map || points.length < 2 || !window.kakao?.maps) return false;

  const bounds = new window.kakao.maps.LatLngBounds();
  points.forEach((point) => {
    bounds.extend(new window.kakao.maps.LatLng(point.lat, point.lng));
  });
  map.setBounds(bounds, FIT_PADDING);
  return true;
}
