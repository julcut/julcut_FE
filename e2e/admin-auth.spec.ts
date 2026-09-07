import { expect, test, type Page } from "@playwright/test";

const admin = {
  adminId: "00000000-0000-0000-0000-000000000001",
  festivalId: null,
  email: "admin@example.com",
  name: "테스트 관리자",
  organization: "축제 운영팀",
  rank: "담당자",
  accountKind: "GOVERNMENT",
  role: null,
  canInviteSubAdmin: true,
  canModifyFestivalInfo: true,
  canViewOperationReport: true,
  canUpdateQueueTail: true,
} as const;

function apiResponse(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ code: 0, message: "OK", data }),
  };
}

async function mockAdminApis(page: Page) {
  await page.route("**/api/admin/auth/login", async (route) => {
    await route.fulfill(apiResponse({ expiresIn: 3600, admin }));
  });
  await page.route("**/api/admin/me", async (route) => {
    await route.fulfill(
      apiResponse({
        adminId: admin.adminId,
        email: admin.email,
        name: admin.name,
        organization: admin.organization,
        rank: admin.rank,
        accountKind: admin.accountKind,
        status: "ACTIVE",
      }),
    );
  });
  await page.route("**/api/admin/me/managed-festivals", async (route) => {
    await route.fulfill(apiResponse([]));
  });
}

test("관리자 로그인 화면을 표시한다", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByLabel("비밀번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

test("로그인 후 보호된 관리자 화면으로 이동한다", async ({ page }) => {
  await mockAdminApis(page);
  await page.goto("/login");

  await page.getByLabel("이메일").fill(admin.email);
  await page.getByLabel("비밀번호").fill("test-password");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/console$/);
  await expect(page.getByText("등록된 축제가 없습니다")).toBeVisible();

  await page.goto("/console/mypage");
  await expect(page.getByText("프로필 설정")).toBeVisible();
  await expect(page.locator(`input[value="${admin.email}"]`)).toBeVisible();
});

test("프로필 조회에 성공했어도 보호된 API가 401이면 만료 안내와 함께 로그인으로 이동한다", async ({
  page,
}) => {
  await mockAdminApis(page);
  await page.goto("/console");
  await expect(page.getByText("등록된 축제가 없습니다")).toBeVisible();

  await page.route("**/api/admin/me/managed-festivals", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: 40100, message: "인증이 필요합니다.", data: null }),
    });
  });
  await page.reload();

  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByText("로그인이 만료되었습니다. 다시 로그인해 주세요.")).toBeVisible();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
});

test("로그인 실패 401은 만료 화면으로 이동하지 않고 다시 로그인할 수 있다", async ({ page }) => {
  let loginAttempts = 0;
  await page.route("**/api/admin/auth/login", async (route) => {
    loginAttempts += 1;
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: 40100,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        data: null,
      }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("이메일").fill(admin.email);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("이메일")).toHaveValue(admin.email);

  await page.getByLabel("비밀번호").fill("another-wrong-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect.poll(() => loginAttempts).toBe(2);
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
