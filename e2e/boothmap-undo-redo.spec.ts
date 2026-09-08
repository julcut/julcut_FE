import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000020";
const mapId = "00000000-0000-0000-0000-0000000000a0";
const boothmapPath = `/console/festivals/${festivalId}/boothmap`;

const BOOTH_NAMES = [
  "김밥천국",
  "떡볶이존",
  "게임존",
  "굿즈샵",
  "체험부스",
  "포토존",
  "플리마켓",
  "공예공방",
  "게임존",
  "책방",
  "아이스크림",
  "붕어빵",
  "안내데스크",
  "의무실",
  "분실물센터",
];

/** 광주 금남로 일대를 흉내 낸 좌표. 부스 15개를 격자로 흩어 놓는다. */
function editorNodes() {
  return BOOTH_NAMES.map((name, index) => ({
    nodeId: `node-${index + 1}`,
    nodeType: "BOOTH" as const,
    name,
    geometryType: "POINT" as const,
    geometry: {
      lat: 35.1495 + Math.floor(index / 5) * 0.0004,
      lng: 126.9195 + (index % 5) * 0.0004,
    },
    confidence: null,
    recognizedText: null,
    source: "MANUAL" as const,
    reviewStatus: "OK" as const,
    sortOrder: index,
    geometrySchemaVersion: "2.0",
  }));
}

const editorZones = [
  { zoneId: "zone-main", name: "메인구역", sortOrder: 0, boothNodeIds: ["node-1", "node-2"] },
  { zoneId: "zone-food", name: "푸드구역", sortOrder: 1, boothNodeIds: ["node-3", "node-4"] },
  { zoneId: "zone-safe", name: "안전구역", sortOrder: 2, boothNodeIds: ["node-14", "node-15"] },
];

async function mockBoothMap(page: Page) {
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      writes.push(`${request.method()} ${path}`);
    }
    let data: unknown;
    let code = 0;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "boothmap-test@example.com",
        name: "테스트 관리자",
        organization: "테스트 운영팀",
        rank: null,
        accountKind: "GOVERNMENT",
        status: "ACTIVE",
      };
    } else if (path === `/api/admin/me/managed-festivals/${festivalId}`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        role: "FESTIVAL_OWNER",
        festivalStatus: "DRAFT",
        locations: [{ primary: true, latitude: 35.1495, longitude: 126.9195 }],
      };
    } else if (path === `/api/festivals/${festivalId}/maps/current`) {
      data = {
        mapId,
        mapName: "테스트 배치",
        editRevision: 3,
        roadmapStatus: "EDITING",
        center: { lat: 35.1495, lng: 126.9195 },
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/editor`) {
      data = {
        mapId,
        editRevision: 3,
        roadmapStatus: "EDITING",
        center: { lat: 35.1495, lng: 126.9195 },
        nodes: editorNodes(),
        zones: editorZones,
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/analysis`) {
      // 좌표 전용 지도라 분석 작업이 없다. 이 화면의 정상 상태다.
      code = 40406;
    }
    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: data === undefined ? code || 40400 : 0,
        message: data === undefined ? "NOT_FOUND" : "OK",
        data: data ?? null,
      }),
    });
  });
  return writes;
}

test("부스 목록 순서 변경을 실행취소·다시실행으로 되돌린다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const writes = await mockBoothMap(page);
  await page.goto(boothmapPath);

  const panel = page.getByRole("complementary");
  const undo = page.getByRole("button", { name: "실행취소", exact: true });
  const redo = page.getByRole("button", { name: "다시실행", exact: true });
  await expect(panel.getByRole("button", { name: "게임존", exact: true })).toBeVisible();

  // 편집 전에는 되돌릴 것이 없다.
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(undo.locator("..")).toHaveAttribute(
    "title",
    "편집 내용이 없어 실행취소할 수 없습니다.",
  );

  const namesOf = async () =>
    (await panel.locator("button > span.truncate").allInnerTexts()).join(",");
  const before = await namesOf();

  // 핸들을 잡고 목록 순서를 바꾼다.
  const handle = panel
    .getByRole("button", { name: "게임존", exact: true })
    .locator("..")
    .locator("span.cursor-grab");
  const target = panel.getByRole("button", { name: "체험부스", exact: true });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();

  const moved = await namesOf();
  expect(moved).not.toBe(before);
  await expect(undo).toBeEnabled();

  await undo.click();
  expect(await namesOf()).toBe(before);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();

  await redo.click();
  expect(await namesOf()).toBe(moved);
  await expect(redo).toBeDisabled();

  // 단축키로도 되돌리고 다시 실행한다.
  await page.keyboard.press("ControlOrMeta+z");
  expect(await namesOf()).toBe(before);
  await page.keyboard.press("Shift+ControlOrMeta+z");
  expect(await namesOf()).toBe(moved);

  // 되돌리는 동안 저장 요청은 나가지 않는다.
  expect(writes).toEqual([]);
});
