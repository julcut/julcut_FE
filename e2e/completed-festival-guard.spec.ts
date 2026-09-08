import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000030";
const mapId = "00000000-0000-0000-0000-0000000000b0";
const staffId = "00000000-0000-0000-0000-0000000000c0";
const boothmapPath = `/console/festivals/${festivalId}/boothmap`;
const staffsPath = `/console/festivals/${festivalId}/staffs`;

/**
 * 종료된 축제(`progressStatus: "COMPLETED"`)를 흉내 내는 목킹.
 * 운영 데이터에 종료된 축제가 없어도 가드가 도는지 확인할 수 있어야 한다.
 * GET이 아닌 요청은 모아 두었다가 "쓰기 요청이 나가지 않았는지" 검증에 쓴다.
 */
async function mockCompletedFestival(page: Page) {
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
        email: "completed-test@example.com",
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
        progressStatus: "COMPLETED",
        startDate: "2026-08-01",
        endDate: "2026-08-03",
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
        nodes: [
          {
            nodeId: "node-1",
            nodeType: "BOOTH",
            name: "김밥천국",
            geometryType: "POINT",
            geometry: { lat: 35.1495, lng: 126.9195 },
            confidence: null,
            recognizedText: null,
            source: "MANUAL",
            reviewStatus: "OK",
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
            source: "MANUAL",
            reviewStatus: "OK",
            sortOrder: 1,
            geometrySchemaVersion: "2.0",
          },
        ],
        zones: [],
      };
    } else if (path === `/api/festivals/${festivalId}/maps/${mapId}/analysis`) {
      // 좌표 전용 지도라 분석 작업이 없다. 이 화면의 정상 상태다.
      code = 40406;
    } else if (path === `/api/festivals/${festivalId}/field-staff`) {
      data = [
        {
          staffId,
          loginId: "staff-completed",
          name: "김스태프",
          phoneNumber: "01012345678",
          validFrom: "2026-08-01",
          validUntil: "2026-08-03",
          status: "ACTIVE",
        },
      ];
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

test("종료된 축제의 부스맵 편집기는 주소로 직접 들어와도 읽기 전용이다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const writes = await mockCompletedFestival(page);
  await page.goto(boothmapPath);

  const panel = page.getByRole("complementary");
  // 지난 축제의 배치는 그대로 볼 수 있어야 한다.
  await expect(panel.getByRole("button", { name: "김밥천국", exact: true })).toBeVisible();
  await expect(panel.getByText("종료된 축제입니다.", { exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "저장하기", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /배치도/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "핀 추가", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "실행취소", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "다시실행", exact: true })).toBeDisabled();

  // 부스를 눌러도 이름·삭제를 다루는 편집 팝오버는 열리지 않는다.
  await panel.getByRole("button", { name: "김밥천국", exact: true }).click();
  await expect(page.getByRole("button", { name: "유형 변경하기", exact: true })).toHaveCount(0);

  expect(writes).toEqual([]);
});

test("종료된 축제의 스태프 화면은 추가를 막고 삭제는 남긴다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockCompletedFestival(page);
  await page.goto(staffsPath);

  await expect(page.getByText("종료된 축제입니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "추가하기", exact: true })).toBeDisabled();
  await expect(page.getByLabel("이름", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("근무구역", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("전화번호", { exact: true })).toBeDisabled();

  // 잘못 만든 계정을 정리하는 길은 남겨 둔다.
  await page.getByRole("checkbox", { name: "김스태프 선택" }).click();
  await expect(page.getByRole("button", { name: "삭제하기", exact: true })).toBeEnabled();
});
