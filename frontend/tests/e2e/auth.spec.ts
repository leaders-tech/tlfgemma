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
  await expect(page.locator("article .prompt")).toHaveText("review me");
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

test("admin changes the shared model while students see the update", async ({ page, browser }) => {
  const student = await browser.newPage();
  await login(student, "model-student@example.org");
  await expect(student.getByLabel("Current model")).toContainText("google/gemma-4-26b-a4b-it");
  await login(page, "admin@example.org");
  await page.getByRole("link", { name: "Review chats" }).click();
  await expect(page.getByLabel("OpenRouter model")).toHaveValue("google/gemma-4-26b-a4b-it");
  await page.getByLabel("OpenRouter model").fill("google/gemma-4-31b-it");
  await page.getByRole("button", { name: "Save model" }).click();
  await expect(page.getByRole("status")).toHaveText("Model saved.");
  await expect(student.getByLabel("Current model")).toContainText("google/gemma-4-31b-it");
  await page.reload();
  await expect(page.getByLabel("OpenRouter model")).toHaveValue("google/gemma-4-31b-it");
  await student.getByLabel("Your message").fill("model check");
  await student.getByRole("button", { name: /Send message/ }).click();
  await expect(student.locator("article .answer-model")).toHaveText("google/gemma-4-31b-it");
  await expect(student.locator(".katex")).toBeVisible();
  await page.getByRole("button", { name: "Use default" }).click();
  await expect(student.getByLabel("Current model")).toContainText("google/gemma-4-26b-a4b-it");
  await expect(student.locator("article .answer-model")).toHaveText("google/gemma-4-31b-it");
  await student.close();
});

test("conversations separate messages, share limits and can be archived and restored", async ({ page }) => {
  await login(page, "conversations@example.org");
  const sidebar = page.getByRole("complementary", { name: "Conversations" });
  await page.getByLabel("Your message").fill("First topic");
  await page.getByRole("button", { name: /Send message/ }).click();
  await expect(page.locator(".katex")).toBeVisible();
  await sidebar.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByText("59", { exact: true })).toBeVisible();
  await page.getByLabel("Your message").fill("Second topic");
  await page.getByRole("button", { name: /Send message/ }).click();
  await expect(page.locator(".katex")).toBeVisible();
  await expect(page.getByText("58", { exact: true })).toBeVisible();
  await sidebar.getByRole("button", { name: "Open chat: First topic", exact: true }).click();
  await expect(page.locator("article .prompt")).toHaveText("First topic");
  await sidebar.getByRole("button", { name: "Archive First topic", exact: true }).click();
  await expect(page.getByLabel("Your message")).toBeDisabled();
  await expect(page.locator("article .prompt")).toHaveText("First topic");
  await page.reload();
  await sidebar.getByRole("button", { name: "Archived", exact: true }).click();
  await sidebar.getByRole("button", { name: "Open chat: First topic", exact: true }).click();
  await expect(page.locator("article .prompt")).toHaveText("First topic");
  await sidebar.getByRole("button", { name: "Restore First topic", exact: true }).click();
  await expect(page.getByLabel("Your message")).toBeEnabled();
  await expect(page.getByText("58", { exact: true })).toBeVisible();
});
