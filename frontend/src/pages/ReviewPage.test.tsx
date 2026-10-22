// Test staff review and admin confirmation. Edit for review behavior; copy for other staff tools.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { AuthContext } from "../app/auth";
import { ReviewPage } from "./ReviewPage";
import { postJson } from "../shared/api";
vi.mock("../shared/api", () => ({ postJson: vi.fn() }));
function page(roles: string[]) {
  return render(
    <AuthContext.Provider
      value={{
        user: { id: 1, email: "staff@example.org", roles },
        loading: false,
        error: "",
        status: "connected",
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      }}
    >
      <ReviewPage />
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(postJson).mockImplementation(async (path) =>
    path === "/chat/model"
      ? { model: "google/gemma-4-26b-a4b-it", default_model: "google/gemma-4-26b-a4b-it" }
      : path === "/review/users"
        ? { users: [{ id: 2, email: "student@example.org", roles: [] }], after: null }
        : path === "/conversations/list"
          ? { conversations: [] }
          : { messages: [], before: null },
  );
});
it("lets teachers inspect users without reset controls", async () => {
  page(["teacher"]);
  fireEvent.click(await screen.findByRole("button", { name: /student@example.org/ }));
  expect(await screen.findByText("No messages yet.")).toBeVisible();
  expect(screen.queryByText("Clear all history")).toBeNull();
  expect(screen.queryByLabelText("OpenRouter model")).toBeNull();
});
it("requires confirmation before admin deletion", async () => {
  page(["admin"]);
  fireEvent.click(screen.getByText("Clear all history"));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(postJson).not.toHaveBeenCalledWith("/admin/clear", expect.anything());
  fireEvent.click(screen.getByText("Delete all messages"));
  await waitFor(() => expect(postJson).toHaveBeenCalledWith("/admin/clear", { confirm: "CLEAR ALL HISTORY" }));
});
