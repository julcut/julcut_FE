import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000010";
const dashboardPath = `/console/festivals/${festivalId}/dashboard`;

type Role = "FESTIVAL_OWNER" | "SUB_ADMIN";

type ProgressStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

async function mockDashboard(
  page: Page,
  role: Role,
  accountKind: "GOVERNMENT" | "CONTRACTOR",
  missingMap = false,
  progressStatus: ProgressStatus = "ONGOING",
) {
  const requests: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(`${request.method()} ${path}`);
    let data: unknown;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "dashboard-test@example.com",
        name: "테스트 관리자",
        organization: "테스트 운영팀",
        rank: null,
        accountKind,
        status: "ACTIVE",
      };
    } else if (path === `/api/admin/me/managed-festivals/${festivalId}`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        role,
        festivalStatus: "DRAFT",
        progressStatus,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        locations: [],
      };
    } else if (path === `/api/festivals/${festivalId}/dashboard`) {
      data = {
        festivalId,
        festivalName: "테스트 축제",
        dataAvailable: true,
        operatingStatus: "OPERATING",
        currentVisitorCount: 120,
        activeQueueCount: 1,
        averageWaitMinutes: 5,
        booths: [
          {
            boothId: 1,
            boothName: "테스트 먹거리 부스",
            roadmapNodePublicId: "test-node",
            lat: 37.5665,
            lng: 126.978,
            congestionLevel: "LOW",
            waitMinutes: 5,
          },
        ],
        zones: [{ zoneId: "test-zone", name: "먹거리 구역", boothNodeIds: ["test-node"] }],
      };
    } else if (path.endsWith("/operations/congestion")) {
      data = { booths: [] };
    } else if (path.endsWith("/operations/map")) {
      data = {
        mapId: "test-map",
        editRevision: 0,
        mapKind: "COORDINATE",
        booths: [],
      };
    } else if (path.endsWith("/operations/queues")) {
      data = { queues: [] };
    } else if (path.endsWith("/operations/suggestions")) {
      data = { suggestions: [] };
    } else if (path.endsWith("/maps/current") && !missingMap) {
      data = {
        mapId: "test-map",
        mapName: "테스트 지도",
        editRevision: 0,
        roadmapStatus: "EDITING",
        center: { lat: 37.5665, lng: 126.978 },
      };
    }
    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: data === undefined ? "FESTIVAL_MAP_NOT_FOUND" : 0,
        message: data === undefined ? "등록된 지도가 없습니다." : "OK",
        data: data ?? null,
      }),
    });
  });
  return requests;
}

for (const scenario of [
  { name: "총괄관리자", role: "FESTIVAL_OWNER", kind: "GOVERNMENT", menuCount: 4 },
  { name: "제2관리자", role: "SUB_ADMIN", kind: "GOVERNMENT", menuCount: 2 },
  { name: "외부업자", role: "SUB_ADMIN", kind: "CONTRACTOR", menuCount: 2 },
] as const) {
  test(`${scenario.name}는 공통 대시보드에서 역할별 메뉴와 부스를 본다`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const requests = await mockDashboard(page, scenario.role, scenario.kind);
    await page.goto(dashboardPath);
    await expect(page).toHaveURL(dashboardPath);
    const navigation = page.getByRole("navigation");
    await expect(navigation.getByRole("link")).toHaveCount(scenario.menuCount);
    await expect(navigation.getByRole("link", { name: "대시보드", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // 부스맵 편집 권한이 없는 운영자에게는 버튼 자체를 노출하지 않는다.
    const isOwner = scenario.role === "FESTIVAL_OWNER";
    const edit = page.getByRole("button", { name: "수정하기", exact: true });
    if (isOwner) await expect(edit).toBeEnabled();
    else await expect(edit).toHaveCount(0);

    await page.getByRole("button", { name: /먹거리 구역/ }).click();
    await expect(
      page
        .getByRole("complementary")
        .getByRole("button", { name: "테스트 먹거리 부스", exact: true }),
    ).toBeVisible();
    expect(requests.filter((request) => request.includes("/editor"))).toEqual([]);

    const sidebar = page.getByRole("complementary");
    const bounds = await sidebar.evaluate((element) => {
      const sidebarRect = element.getBoundingClientRect();
      const mapRect = element.parentElement!.parentElement!.getBoundingClientRect();
      return {
        left: sidebarRect.left - mapRect.left,
        top: sidebarRect.top - mapRect.top,
        bottom: mapRect.bottom - sidebarRect.bottom,
      };
    });
    expect(bounds).toEqual({ left: 32, top: 40, bottom: 40 });
    const outer = await sidebar.locator("..").locator("..").boundingBox();
    const zoom = await page.getByRole("button", { name: "지도 축소", exact: true }).boundingBox();
    expect(outer && zoom).toBeTruthy();
    if (isOwner) {
      const button = await edit.boundingBox();
      expect(button).toBeTruthy();
      expect(button!.y - outer!.y).toBe(40);
      expect(outer!.x + outer!.width - button!.x - button!.width).toBe(32);
    }
    expect(outer!.x + outer!.width - zoom!.x - zoom!.width).toBe(32);
    const metrics = await page
      .getByText("현재 방문자수", { exact: true })
      .locator("..")
      .locator("..")
      .locator("..")
      .boundingBox();
    expect(metrics).toBeTruthy();
    expect(metrics!.y - zoom!.y - zoom!.height).toBe(24);
  });
}

test("진행예정 축제의 대시보드는 실시간 지표 대신 준비 현황을 보여준다", async ({ page }) => {
  const requests = await mockDashboard(page, "FESTIVAL_OWNER", "GOVERNMENT", false, "UPCOMING");
  await page.goto(dashboardPath);
  await expect(page.getByText("등록된 부스", { exact: true })).toBeVisible();
  await expect(page.getByText("개막까지", { exact: true })).toBeVisible();
  await expect(page.getByText("활성 대기열", { exact: true })).toHaveCount(0);
  await expect(page.getByText("현재 방문자수", { exact: true })).toHaveCount(0);
  /*
    시작하지 않은 축제에 실시간 조회를 걸지 않는다. 운영 지도(`/operations/map`)는
    부지 경계·팜플렛을 그리는 읽기 전용 조회라 개막 전에도 부른다 — 실시간 지표가 아니다.
  */
  expect(
    requests.filter((request) => /\/operations\/(congestion|queues|suggestions)/.test(request)),
  ).toEqual([]);
});

test("종료된 축제의 대시보드는 부스맵 수정을 막고 결과리포트로 안내한다", async ({ page }) => {
  await mockDashboard(page, "FESTIVAL_OWNER", "GOVERNMENT", false, "COMPLETED");
  await page.goto(dashboardPath);
  await expect(page.getByText("종료된 축제입니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "결과리포트 보기", exact: true })).toHaveAttribute(
    "href",
    `/console/festivals/${festivalId}/report`,
  );
  await expect(page.getByRole("button", { name: "수정하기", exact: true })).toBeDisabled();
});

test("부스가 하나도 없으면 부스맵을 만들라고 안내한다", async ({ page }) => {
  await mockDashboard(page, "FESTIVAL_OWNER", "GOVERNMENT");
  // 나중에 등록한 라우트가 먼저 매칭되므로 부스 없는 응답을 뒤에 덮어씌운다.
  await page.route("**/api/festivals/*/dashboard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "OK",
        data: {
          festivalId,
          festivalName: "테스트 축제",
          dataAvailable: false,
          operatingStatus: "OPERATING",
          currentVisitorCount: null,
          activeQueueCount: null,
          averageWaitMinutes: null,
          booths: [],
          zones: [],
        },
      }),
    });
  });
  await page.goto(dashboardPath);
  await expect(page.getByText("아직 등록된 부스가 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "부스맵 만들기", exact: true })).toHaveAttribute(
    "href",
    `/console/festivals/${festivalId}/boothmap`,
  );
});

test("현재 지도가 없어도 부스를 표시하고 지도를 생성하지 않는다", async ({ page }) => {
  const requests = await mockDashboard(page, "FESTIVAL_OWNER", "GOVERNMENT", true);
  await page.goto(dashboardPath);
  await expect(page.getByText("등록된 지도가 없습니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /먹거리 구역/ }).click();
  await expect(
    page
      .getByRole("complementary")
      .getByRole("button", { name: "테스트 먹거리 부스", exact: true }),
  ).toBeVisible();
  expect(requests.filter((request) => request.startsWith("POST "))).toEqual([]);
  expect(requests.filter((request) => request.includes("/editor"))).toEqual([]);
});

test("메인 축제 카드는 각 축제에서 본인이 맡은 역할의 화면으로 연결한다", async ({ page }) => {
  await mockDashboard(page, "SUB_ADMIN", "GOVERNMENT");
  const ownerFestivalId = "00000000-0000-0000-0000-000000000020";
  await page.route("**/api/admin/me/managed-festivals", async (route) => {
    const common = {
      festivalYear: 2026,
      festivalStatus: "DRAFT",
      progressStatus: "UPCOMING",
      address: "서울",
      detailAddress: "행사장",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "OK",
        data: [
          {
            ...common,
            festivalId: ownerFestivalId,
            festivalName: "총괄 담당 축제",
            role: "FESTIVAL_OWNER",
          },
          { ...common, festivalId, festivalName: "운영 담당 축제", role: "SUB_ADMIN" },
        ],
      }),
    });
  });
  await page.goto("/console");
  await expect(page.getByRole("link", { name: /총괄 담당 축제/ })).toHaveAttribute(
    "href",
    `/console/festivals/${ownerFestivalId}`,
  );
  const operatorCard = page.getByRole("link", { name: /운영 담당 축제/ });
  await expect(operatorCard).toHaveAttribute("href", dashboardPath);
  await operatorCard.click();
  await expect(page).toHaveURL(dashboardPath);
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(2);
});

for (const suffix of ["", "/operators", "/operators/test-admin", "/report"]) {
  test(`제2관리자가 총괄 전용 ${suffix || "축제관리"} 주소에 접근하면 대시보드로 이동한다`, async ({
    page,
  }) => {
    await mockDashboard(page, "SUB_ADMIN", "GOVERNMENT");
    await page.goto(`/console/festivals/${festivalId}${suffix}`);
    await expect(page).toHaveURL(dashboardPath);
    await expect(page.getByRole("button", { name: "수정하기", exact: true })).toHaveCount(0);
  });
}

test("작은 화면에서 부스 목록을 열고 닫아 지도를 조작한다", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockDashboard(page, "SUB_ADMIN", "GOVERNMENT");
  await page.goto(dashboardPath);
  const toggle = page.getByRole("button", { name: "부스 목록", exact: true });
  await expect(toggle).toBeVisible();
  await expect(page.getByRole("complementary")).toBeHidden();
  await toggle.click();
  await page.getByRole("button", { name: /먹거리 구역/ }).click();
  await page.getByRole("button", { name: "테스트 먹거리 부스", exact: true }).click();
  await expect(page.getByRole("complementary")).toBeHidden();
  await expect(
    page.getByText("테스트 먹거리 부스", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
