// Test session startup and failures. Edit for auth state changes; copy for other providers.
import { render, screen } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./auth";
import { ApiError, postJson } from "../shared/api";
vi.mock("../shared/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../shared/api")>()), postJson: vi.fn() }));
vi.mock("../shared/socket", () => ({ createUserSocket: () => ({ stop: vi.fn() }) }));
function View() {
  const auth = useAuth();
  return (
    <div>
      {auth.loading ? "Loading" : auth.user?.email || "Anonymous"}
      {auth.error}
    </div>
  );
}
beforeEach(() => vi.clearAllMocks());
it("loads the session", async () => {
  vi.mocked(postJson).mockResolvedValue({ user: { id: 1, email: "student@example.org", roles: [] } });
  render(
    <AuthProvider>
      <View />
    </AuthProvider>,
  );
  expect(await screen.findByText("student@example.org")).toBeVisible();
});
it("treats expired sessions as anonymous", async () => {
  vi.mocked(postJson).mockRejectedValue(new ApiError(401, "not_authenticated", "Login required"));
  render(
    <AuthProvider>
      <View />
    </AuthProvider>,
  );
  expect(await screen.findByText("Anonymous")).toBeVisible();
  expect(postJson).toHaveBeenCalledTimes(1);
});
it("shows server errors instead of an unhandled rejection", async () => {
  vi.mocked(postJson).mockRejectedValue(new Error("Server unavailable"));
  render(
    <AuthProvider>
      <View />
    </AuthProvider>,
  );
  expect(await screen.findByText(/Server unavailable/)).toBeVisible();
});
