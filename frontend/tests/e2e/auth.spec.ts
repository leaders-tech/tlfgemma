// Verify OIDC, streaming and staff tools in a real browser. Edit for user flows; copy for new e2e scenarios.
import { expect, test, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: /Sign in with TLF/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "My chat" })).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
}
test("student signs in, streams markdown, copies raw text, reloads and signs out", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, "student-browser@example.org");
  const input = page.getByLabel("Your message");
  await input.fill("🦊".repeat(1001));
  await expect(page.getByText("-1 characters left")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send message/ })).toBeDisabled();
  await input.fill("hello");
  await page.getByRole("button", { name: /Send message/ }).click();
  await expect(page.locator(".katex")).toBeVisible();
  await expect(page.getByRole("button", { name: /Send message/ })).toBeVisible();
  await page.getByRole("button", { name: "Copy raw" }).click();
  await expect(page.getByText("Copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("**Hello**");
  await page.reload();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator(".katex")).toBeVisible();
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "My chat" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: /Sign in with TLF/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test("teacher reviews student history and has their own limited chat", async ({ page, browser }) => {
  const student = await browser.newPage();
  await login(student, "review-student@example.org");
  await student.getByLabel("Your message").fill("review me");
  await student.getByRole("button", { name: /Send message/ }).click();
  await expect(student.locator(".katex")).toBeVisible();
  await login(page, "teacher@example.org");
  await expect(page.getByText("60", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Review chats" }).click();
  await page.getByLabel("Find a user").fill("review-student");
  await page.getByRole("button", { name: /review-student@example.org/ }).click();
  await expect(page.getByText("review me", { exact: true })).toBeVisible();
  await expect(page.getByText("Clear all history", { exact: true })).toHaveCount(0);
  await student.close();
});
test("empty provider errors restore the limit", async ({ page }) => {
  await login(page, "error-student@example.org");
  await page.getByLabel("Your message").fill("fail");
  await page.getByRole("button", { name: /Send message/ }).click();
  await expect(page.getByText(/This attempt does not use your limit/)).toBeVisible();
  await expect(page.getByText("60", { exact: true })).toBeVisible();
});
test("admin clears active answers for everyone", async ({ page, browser }) => {
  const student = await browser.newPage();
  await login(student, "clear-student@example.org");
  await login(page, "admin@example.org");
  await page.getByRole("link", { name: "Review chats" }).click();
  await student.getByLabel("Your message").fill("slow");
  await student.getByRole("button", { name: /Send message/ }).click();
  await expect(student.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear all history", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete all messages" }).click();
  await expect(student.locator("article")).toHaveCount(0);
  await expect(student.getByText("60", { exact: true })).toBeVisible();
  await student.reload();
  await expect(student.locator("article")).toHaveCount(0);
  await student.close();
});
// Global reset changes all histories, so these scenarios intentionally run serially.
test.describe.configure({ mode: "serial" });
