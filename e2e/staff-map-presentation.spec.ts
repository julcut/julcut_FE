import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000020";

/** 부지 경계·팜플렛이 모두 등록된 축제의 운영 지도 응답. */
const presentation = {
  boundary: {
    geometryType: "POLYGON",
    schemaVersion: "2.0",
    points: [
      { lat: 37.5666, lng: 126.9776 },
      { lat: 37.5666, lng: 126.9784 },
      { lat: 37.566, lng: 126.9784 },
      { lat: 37.566, lng: 126.9776 },
    ],
  },
  overlay: {
    assetId: "test-asset",
    imageUrl: "https://example.com/pamphlet.png",
    imageUrlExpiresAt: null,
    imageWidth: 1000,
    imageHeight: 800,
    anchor: {
      centerLatitude: 37.5663,
      centerLongitude: 126.978,
      groundWidthMeters: 120,
      rotationDegrees: 12,
    },
    corners: null,
    opacity: 0.7,
    visible: true,
    clipToBoundary: true,
  },
};

/**
 * 스태프 화면이 쓰는 API를 모두 가로챈다.
 * `operationsMapStatus`를 200이 아닌 값으로 주면 경계·팜플렛 조회만 실패시킬 수 있다.
 */
async function mockStaffMap(page: Page, { operationsMapStatus = 200 } = {}) {
  const requests: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(`${request.method()} ${path}`);

    if (path.endsWith("/operations/map") && operationsMapStatus !== 200) {
      await route.fulfill({
        status: operationsMapStatus,
        contentType: "application/json",
        body: JSON.stringify({ code: "FORBIDDEN", message: "권한이 없습니다.", data: null }),
      });
      return;
    }

    let data: unknown;
    if (path === "/api/field-staff/auth/me") {
      data = {
        staffId: "00000000-0000-0000-0000-000000000021",
        festivalId,
        loginId: "staff01",
        name: "테스트 스태프",
      };
    } else if (path === `/api/festivals/${festivalId}/dashboard`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        dataAvailable: true,
        operatingStatus: "OPERATING",
        currentVisitorCount: 120,
        activeQueueCount: 1,
        averageWaitMinutes: 7,
        booths: [
          {
            boothId: 1,
            boothName: "테스트 먹거리 부스",
            roadmapNodePublicId: "test-node",
            lat: 37.5663,
            lng: 126.978,
            congestionLevel: "LOW",
            waitMinutes: 7,
          },
        ],
        zones: [{ zoneId: "test-zone", name: "먹거리 구역", boothNodeIds: ["test-node"] }],
      };
    } else if (path.endsWith("/operations/map")) {
      data = {
        mapId: "test-map",
        editRevision: 0,
        mapKind: "COORDINATE",
        presentation,
        booths: [],
      };
    } else if (path.endsWith("/operations/queues")) {
      data = { festivalId, queues: [] };
    }

    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: data === undefined ? "NOT_FOUND" : 0,
        message: data === undefined ? "없습니다." : "OK",
        data: data ?? null,
      }),
    });
  });
  return requests;
}

test("스태프 지도는 편집기 API 대신 현장 운영 지도로 경계·팜플렛을 받는다", async ({ page }) => {
  const requests = await mockStaffMap(page);
  await page.goto("/staff/dashboard");

  await expect(page.getByText("테스트 축제", { exact: true })).toBeVisible();
  await expect
    .poll(() => requests.filter((request) => request.endsWith("/operations/map")))
    .toEqual([`GET /api/festivals/${festivalId}/operations/map`]);
  // 편집기 계약은 총괄관리자 전용이라 스태프 토큰으로는 열리지 않는다.
  expect(requests.filter((request) => request.includes("/editor"))).toEqual([]);
});

test("경계·팜플렛 조회가 실패해도 스태프 지도와 하단바는 그대로 뜬다", async ({ page }) => {
  await mockStaffMap(page, { operationsMapStatus: 403 });
  await page.goto("/staff/dashboard");

  await expect(page.getByText("테스트 축제", { exact: true })).toBeVisible();
  await expect(page.getByText("예상 대기시간", { exact: true })).toBeVisible();
  await expect(page.getByText("담당 축제 정보를 불러오지 못했습니다.")).toHaveCount(0);
});
