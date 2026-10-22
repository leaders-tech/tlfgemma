// Test authenticated routes. Edit for navigation changes; copy for new route guards.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, it, expect } from "vitest";
import { App } from "./App";
import { AuthContext } from "./auth";
import type { User } from "../shared/types";
vi.mock("../pages/ChatWorkspace", () => ({ ChatWorkspace: () => <h1>My chat</h1> }));
vi.mock("../pages/ReviewPage", () => ({ ReviewPage: () => <h1>Review chats</h1> }));
function renderApp(path: string, user: User | null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={{ user, loading: false, error: "", status: "connected", login: vi.fn(), logout: vi.fn(), reloadUser: vi.fn() }}>
        <App />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
it("requires login", () => {
  renderApp("/", null);
  expect(screen.getByRole("button", { name: /Sign in with TLF/ })).toBeVisible();
});
it("keeps students out of review", () => {
  renderApp("/review", { id: 1, email: "student@example.org", roles: [] });
  expect(screen.getByRole("heading", { name: "My chat" })).toBeVisible();
  expect(screen.queryByText("Review chats")).toBeNull();
});
it("lets teachers review", () => {
  renderApp("/review", { id: 1, email: "teacher@example.org", roles: ["teacher"] });
  expect(screen.getByRole("heading", { name: "Review chats" })).toBeVisible();
});
