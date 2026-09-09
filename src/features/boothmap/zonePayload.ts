import { boothIdsToNodeIds, type LocalBoothPin, type LocalMapShape } from "./geometryWgs84";

/** 체크박스로 부스를 골라 만든 구역. */
export interface ZoneGroup {
  id: string;
  name: string;
  boothIds: string[];
}

export interface ZoneChangePayload {
  zoneId: string;
  name: string;
  sortOrder: number;
  boothNodeIds: string[];
}

/**
 * 저장 요청에 담을 구역-부스 묶음.
 *
 * <p>구역 폴리곤은 화면에서만 좌표로 소속을 판정하고 저장 요청에는 담기지 않았다. 그래서
 * 관리자 목록에는 «로스터리 마켓존 2»처럼 보여도 서버의 zones는 비어 있었고, 그것만 읽는
 * 방문객 앱에서는 부스가 전부 «구역 미지정»으로 떨어졌다. 화면에서 보이는 묶음을 그대로
 * 저장하도록 폴리곤 구역도 함께 담는다.</p>
 *
 * <p>서버는 부스 하나가 두 구역에 들어가면 저장 전체를 거부하므로, 앞선 구역이 이미 가져간
 * 부스는 뒤 구역에서 뺀다. BOOTH가 아닌 핀(화장실·입구 등)도 같은 이유로 뺀다.</p>
 */
export function buildZoneChanges({
  zones,
  booths,
  polygonShapes,
  shapeIdByBoothId,
}: {
  zones: ZoneGroup[];
  booths: LocalBoothPin[];
  polygonShapes: LocalMapShape[];
  shapeIdByBoothId: Map<string, string>;
}): ZoneChangePayload[] {
  const boothById = new Map(booths.map((booth) => [booth.id, booth]));
  const taken = new Set<string>();
  const changes: ZoneChangePayload[] = [];

  const add = (zoneId: string, name: string, boothIds: string[]) => {
    const label = name.trim();
    if (!label) return;
    const usable = boothIds.filter(
      (id) => boothById.get(id)?.nodeType === "BOOTH" && !taken.has(id),
    );
    if (usable.length === 0) return;
    usable.forEach((id) => taken.add(id));
    changes.push({
      zoneId,
      name: label,
      sortOrder: changes.length,
      boothNodeIds: boothIdsToNodeIds(usable, booths),
    });
  };

  zones.forEach((zone) => add(zone.id, zone.name, zone.boothIds));
  polygonShapes.forEach((shape) => {
    const members = booths
      .filter((booth) => shapeIdByBoothId.get(booth.id) === shape.id)
      .map((booth) => booth.id);
    // 아직 저장 전인 폴리곤은 nodeId가 없다. 그때는 서버가 그대로 노드 id로 쓰는 로컬 id를 쓴다.
    add(shape.nodeId ?? shape.id, shape.name, members);
  });

  return changes;
}
