// Test the OIDC sign-in screen. Edit for login changes; copy for another public page.
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import { AuthContext } from "../app/auth";
import { LoginPage } from "./LoginPage";
it("reports login failures and allows retry", async () => {
  const login = vi.fn().mockRejectedValue(new Error("Login is not configured yet."));
  render(
    <AuthContext.Provider value={{ user: null, loading: false, error: "", status: "idle", login, logout: vi.fn(), reloadUser: vi.fn() }}>
      <LoginPage />
    </AuthContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Login is not configured yet.");
  expect(screen.getByRole("button")).toBeEnabled();
});
