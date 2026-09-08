import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000040";
const mapId = "00000000-0000-0000-0000-0000000000d0";
const boothmapPath = `/console/festivals/${festivalId}/boothmap`;

/**
 * 부스맵 공개 흐름 목킹.
 *
 * 사용자 앱은 로드맵이 PUBLISHED일 때만 부스지도를 채우므로, 관리자 화면에 공개 버튼이
 * 실제로 있고 서버로 요청이 나가는지가 이 화면의 핵심이다. 공개 요청이 한 번 들어오면
 * 그 뒤의 편집기 조회는 PUBLISHED를 돌려주도록 해 화면 전환까지 확인한다.
 */
async function mockBoothMap(page: Page, initialStatus: "EDITING" | "PUBLISHED") {
  const publishCalls: string[] = [];
  let status = initialStatus;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown;
    let code = 0;
    if (request.method() === "POST" && path.endsWith("/publish")) {
      publishCalls.push(path);
      status = "PUBLISHED";
      data = { roadmapStatus: "PUBLISHED", publishedVersion: 3, publishedBoothCount: 2 };
    } else if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "publish-test@example.com",
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
        progressStatus: "UPCOMING",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        locations: [{ primary: true, latitude: 35.1495, longitude: 126.9195 }],
      };
    } else if (path === `/api/festivals/${festivalId}/maps/current`) {
      data = {
        mapId,
        mapName: "테스트 배치",
        editRevision: 3,
        roadmapStatus: status,
        center: { lat: 35.1495, lng: 126.9195 },
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/editor`) {
      data = {
        mapId,
        editRevision: 3,
        roadmapStatus: status,
        center: { lat: 35.1495, lng: 126.9195 },
        nodes: [
          {
            nodeId: "node-1",
            nodeType: "BOOTH",
            name: "김밥천국",
            geometryType: "POINT",
            geometry: { lat: 35.1495, lng: 126.9195 },
            confidence: null,
            recognizedText: null,
            source: "ADMIN",
            reviewStatus: "CONFIRMED",
            sortOrder: 0,
            geometrySchemaVersion: "2.0",
          },
          {
            nodeId: "node-2",
            nodeType: "BOOTH",
            name: "떡볶이존",
            geometryType: "POINT",
            geometry: { lat: 35.1499, lng: 126.9199 },
            confidence: null,
            recognizedText: null,
            source: "ADMIN",
            reviewStatus: "CONFIRMED",
            sortOrder: 1,
            geometrySchemaVersion: "2.0",
          },
        ],
        zones: [],
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
  return publishCalls;
}

test("편집 중인 부스맵은 확인 모달을 거쳐 방문객에게 공개된다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const publishCalls = await mockBoothMap(page, "EDITING");
  await page.goto(boothmapPath);

  const publishButton = page.getByRole("button", { name: "방문객에게 공개", exact: true });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  // 되돌리기 어려운 동작이라 무엇이 방문객에게 보이는지 먼저 알린다.
  await expect(
    page.getByText("방문객 앱 «부스지도»에 그대로 보입니다", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "공개", exact: true }).click();

  await expect(page.getByText("공개됨", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "방문객에게 공개", exact: true })).toHaveCount(0);
  expect(publishCalls).toEqual([`/api/festivals/${festivalId}/maps/${mapId}/publish`]);
});

test("이미 공개된 부스맵은 버튼 대신 공개됨 표시만 남는다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const publishCalls = await mockBoothMap(page, "PUBLISHED");
  await page.goto(boothmapPath);

  await expect(page.getByText("공개됨", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "방문객에게 공개", exact: true })).toHaveCount(0);
  expect(publishCalls).toEqual([]);
});
