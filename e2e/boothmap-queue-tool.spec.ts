import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000041";
const mapId = "00000000-0000-0000-0000-0000000000d1";
const boothNodeId = "00000000-0000-0000-0000-0000000000a1";
const boothmapPath = `/console/festivals/${festivalId}/boothmap`;

/**
 * 대기줄 도구는 부스를 고른 상태에서만 열린다.
 *
 * 여기서는 «부스를 고르면 버튼이 열린다»는 연결만 지킨다. 이 환경에는 카카오 지도가
 * 없어 지도 위 말풍선이 렌더되지 않으므로, 말풍선의 바깥 클릭 판정까지는 재현되지
 * 않는다. 그 판정은 keepsPopoverOpen 단위 테스트가 맡는다.
 */
async function mockBoothMap(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown;
    let code = 0;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "queue-test@example.com",
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
        editRevision: 1,
        roadmapStatus: "EDITING",
        center: { lat: 35.1495, lng: 126.9195 },
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/editor`) {
      data = {
        mapId,
        editRevision: 1,
        roadmapStatus: "EDITING",
        center: { lat: 35.1495, lng: 126.9195 },
        nodes: [
          {
            nodeId: boothNodeId,
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
            // 승인된 운영 부스와 이어져 있어야 대기줄을 그릴 수 있다.
            relatedBoothId: 501,
          },
        ],
        zones: [],
      };
    } else if (path === `/api/festivals/${festivalId}/operations/queues`) {
      data = {
        queues: [
          {
            queueId: "00000000-0000-0000-0000-0000000000b1",
            boothId: 501,
            boothName: "김밥천국",
            tailLatitude: null,
            tailLongitude: null,
            queueTailMeters: null,
            path: null,
            lastModifierType: null,
            lastModifierName: null,
            updatedAt: "2026-09-09T00:00:00",
          },
        ],
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/analysis`) {
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
}

test("부스를 고른 뒤 대기줄 버튼을 누르면 대기줄 도구가 열린다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockBoothMap(page);
  await page.goto(boothmapPath);

  await page.getByRole("button", { name: "김밥천국", exact: true }).first().click();

  const queueButton = page.getByRole("button", { name: "대기줄 추가" });
  await expect(queueButton).toBeEnabled();
  await queueButton.click();

  await expect(queueButton).toHaveAttribute("aria-pressed", "true");
  // 도구를 켜도 부스 선택은 살아 있어야 대기줄을 그 부스에 붙일 수 있다.
  await expect(queueButton).toBeEnabled();
});
