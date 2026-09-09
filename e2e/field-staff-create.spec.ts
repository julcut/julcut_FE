import { expect, test, type Page } from "@playwright/test";

const festivalId = "00000000-0000-0000-0000-000000000040";
const staffsPath = `/console/festivals/${festivalId}/staffs`;

/** 축제 시작(2026-10-08) 7일 전부터 종료일까지 로그인할 수 있는 계정. */
const created = {
  staffId: "00000000-0000-0000-0000-000000000041",
  loginId: "staff-abc12345",
  name: "김스태프",
  department: "정문",
  phoneNumber: "010-1234-5678",
  validFrom: "2026-10-01T00:00:00",
  validUntil: "2026-10-10T23:59:59",
  temporaryPassword: "Temp1234!",
};

async function mockConsoleApis(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    let data: unknown;
    if (path === "/api/admin/me") {
      data = {
        adminId: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.com",
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
        startDate: "2026-10-08",
        endDate: "2026-10-10",
        locations: [],
      };
    } else if (path === `/api/festivals/${festivalId}/field-staff`) {
      data = request.method() === "POST" ? created : [];
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
}

test("스태프 계정을 만들면 임시 비밀번호와 함께 로그인 가능 기간을 안내한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockConsoleApis(page);
  await page.goto(staffsPath);

  await page.getByLabel("이름").fill(created.name);
  await page.getByLabel("근무구역").fill(created.department);
  await page.getByLabel("전화번호").fill("01012345678");
  await page.getByRole("button", { name: "추가하기" }).click();

  await expect(page.getByText(`임시 비밀번호: ${created.temporaryPassword}`)).toBeVisible();
  // 계정을 만들어도 축제 시작 7일 전이 되기 전에는 로그인할 수 없다는 것을 함께 알려준다.
  await expect(
    page.getByText(/로그인 가능 기간: .*축제 시작 7일 전부터 로그인할 수 있습니다/),
  ).toBeVisible();
});
