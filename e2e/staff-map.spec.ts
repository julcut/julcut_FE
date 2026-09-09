import { expect, test, type Page, type Request } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000030";
const staffName = "김스태프";

/** 타임존 표기 없이 UTC로 내려오는 서버 시각 문자열(`2026-09-09T05:06:37`). */
function serverNow(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "");
}

function apiBody(data: unknown) {
  return JSON.stringify({ code: 0, message: "OK", data });
}

interface MockOptions {
  /** 부스에 대기열이 붙어 있는지. 없으면 줄끝 갱신 버튼이 잠긴다. */
  withQueue?: boolean;
  congestionUpdatedAt?: string;
}

/** 스태프 화면이 쓰는 API를 모두 가로채고, 지나간 요청을 기록해 돌려준다. */
async function mockStaffApis(page: Page, options: MockOptions = {}) {
  const { withQueue = true, congestionUpdatedAt = serverNow() } = options;
  const requests: Request[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(request);

    let data: unknown;
    if (path === "/api/field-staff/auth/me") {
      data = {
        staffId: "00000000-0000-0000-0000-000000000031",
        festivalId,
        loginId: "staff01",
        name: staffName,
      };
    } else if (path === "/api/field-staff/auth/logout") {
      data = null;
    } else if (path === `/api/festivals/${festivalId}/dashboard`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        dataAvailable: true,
        operatingStatus: "OPERATING",
        currentVisitorCount: 120,
        activeQueueCount: 1,
        averageWaitMinutes: 7,
        updatedAt: congestionUpdatedAt,
        booths: [
          {
            boothId: 1,
            boothName: "떡볶이 부스",
            roadmapNodePublicId: "node-1",
            lat: 37.5663,
            lng: 126.978,
            congestionLevel: "HIGH",
            waitMinutes: 30,
            congestionUpdatedAt,
            modifierType: "STAFF",
            modifierName: staffName,
          },
          {
            boothId: 2,
            boothName: "솜사탕 부스",
            roadmapNodePublicId: "node-2",
            lat: 37.5665,
            lng: 126.9782,
            congestionLevel: "LOW",
            waitMinutes: 3,
          },
        ],
        zones: [
          { zoneId: "zone-1", name: "먹거리 구역", sortOrder: 1, boothNodeIds: ["node-1"] },
          { zoneId: "zone-2", name: "체험 구역", sortOrder: 2, boothNodeIds: ["node-2"] },
        ],
      };
    } else if (path.endsWith("/operations/queues")) {
      data = {
        festivalId,
        queues: withQueue
          ? [
              {
                queueId: "queue-1",
                boothId: 1,
                boothName: "떡볶이 부스",
                tailLatitude: 37.5664,
                tailLongitude: 126.9781,
                queueTailMeters: 15,
                path: null,
                lastModifierType: "STAFF",
                lastModifierName: staffName,
                updatedAt: congestionUpdatedAt,
              },
            ]
          : [],
      };
    } else if (path.endsWith("/operations/map")) {
      data = { mapId: "test-map", editRevision: 0, mapKind: "COORDINATE", booths: [] };
    } else if (path.endsWith("/congestion") && request.method() === "PUT") {
      data = null;
    } else if (path.includes("/operations/queues/") && request.method() === "PATCH") {
      data = { queueId: "queue-1", boothId: 1 };
    }

    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      body:
        data === undefined
          ? JSON.stringify({ code: "NOT_FOUND", message: "없습니다.", data: null })
          : apiBody(data),
    });
  });

  return requests;
}

test("부스검색에서 고른 부스가 지도 화면 하단바에 반영된다", async ({ page }) => {
  await mockStaffApis(page);
  await page.goto("/staff/dashboard");
  await expect(page.getByText("테스트 축제", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "부스 검색" }).click();
  await expect(page).toHaveURL(/\/staff\/booths$/);
  await page.getByLabel("부스명 검색").fill("솜사탕");
  await page.getByRole("button", { name: /솜사탕 부스/ }).click();

  await expect(page).toHaveURL(/\/staff\/dashboard\?boothId=2$/);
  await expect(page.getByText("체험 구역 > 솜사탕 부스")).toBeVisible();
});

test("줄끝 갱신 시트에서 혼잡도와 대기시간을 직접 정해 저장한다", async ({ page }) => {
  const requests = await mockStaffApis(page);
  await page.goto(`/staff/dashboard?boothId=1`);

  await page.getByRole("button", { name: "줄끝 갱신" }).click();

  // 자동 환산값이 기본으로 채워져 있고, 마지막 갱신자도 남아 있다.
  await expect(page.getByRole("button", { name: "혼잡", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("예상 대기시간(분)")).toHaveValue("30");
  await expect(page.getByText("마지막 혼잡도 갱신자")).toBeVisible();

  await page.getByRole("button", { name: "여유", exact: true }).click();
  await page.getByLabel("예상 대기시간(분)").fill("5");
  await page.getByRole("button", { name: "갱신하기" }).click();

  await expect
    .poll(() =>
      requests
        .filter((request) => request.method() === "PUT")
        .map((request) => new URL(request.url()).pathname),
    )
    .toEqual([`/api/festivals/${festivalId}/booths/1/congestion`]);

  const congestionRequest = requests.find((request) => request.method() === "PUT");
  expect(congestionRequest?.postDataJSON()).toEqual({
    waitMinutes: 5,
    congestionLevel: "LOW",
  });
  // 혼잡도만 고쳤으므로 줄끝 갱신 요청은 나가지 않는다.
  expect(requests.filter((request) => request.method() === "PATCH")).toEqual([]);
});

/*
  서버는 타임존 표기 없이 UTC로 시각을 내려준다. 브라우저 타임존이 UTC면 어긋남이
  드러나지 않으므로, 이 회귀 테스트만 한국 시간대로 고정한다.
*/
test.describe("갱신 시각 표기", () => {
  test.use({ timezoneId: "Asia/Seoul" });

  test("타임존 표기가 없는 UTC 시각을 방금 전으로 읽는다", async ({ page }) => {
    await mockStaffApis(page);
    await page.goto(`/staff/dashboard?boothId=1`);
    await page.getByRole("button", { name: "줄끝 갱신" }).click();

    await expect(page.getByText("방금 전")).toBeVisible();
    await expect(page.getByText("9시간 전")).toHaveCount(0);
  });
});

test("지도 확대 버튼은 최대 확대 상태에서 비활성화된다", async ({ page }) => {
  await mockStaffApis(page);
  await page.goto("/staff/dashboard");

  const zoomIn = page.getByRole("button", { name: "지도 확대" });
  const zoomOut = page.getByRole("button", { name: "지도 축소" });

  await expect(zoomIn).toBeDisabled();
  await expect(zoomOut).toBeEnabled();

  // 한 번만 축소해도 곧바로 확대할 수 있어야 한다(헛클릭이 쌓이지 않는다).
  await zoomOut.click();
  await expect(zoomIn).toBeEnabled();
});
