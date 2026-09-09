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

test("스태프 상단바는 축지법 워드마크와 로그인한 스태프 이름을 보여준다", async ({ page }) => {
  await mockStaffApis(page);
  await page.goto("/staff/dashboard");

  const header = page.getByRole("banner");
  await expect(header.getByText("축지법")).toBeVisible();
  await expect(header.getByText("로고")).toHaveCount(0);
  await expect(header.getByText(`${staffName} 님`)).toBeVisible();
});

test("로그아웃해도 담당 축제 ID가 남아 다시 로그인할 수 있다", async ({ page }) => {
  await mockStaffApis(page);
  await page.goto("/staff/dashboard");

  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "로그아웃" }).click();

  await expect(page).toHaveURL(new RegExp(`/staff/login\\?festivalId=${festivalId}$`));

  // 축제 ID가 없으면 폼이 제출되지 않고 초대 링크 안내만 뜬다.
  await page.getByLabel("아이디").fill("staff01");
  await page.getByLabel("비밀번호").fill("password");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("축제 운영자가 전달한 초대 링크로 접속해주세요.")).toHaveCount(0);
});

test("로그인 실패 안내는 서버 문구를 그대로 보여주고 입력을 고치면 사라진다", async ({ page }) => {
  const message = "2026. 9. 2.부터 로그인할 수 있습니다.";
  await page.route("**/api/field-staff/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNAUTHORIZED", message, data: null }),
    });
  });

  await page.goto(`/staff/login?festivalId=${festivalId}`);
  await page.getByLabel("아이디").fill("staff01");
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText(message)).toBeVisible();

  await page.getByLabel("비밀번호").fill("another-password");
  await expect(page.getByText(message)).toHaveCount(0);
});
