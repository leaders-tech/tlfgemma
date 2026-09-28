/*
This file tests the shared auth provider and its startup session-loading behavior.
Edit this file when auth bootstrap, login state loading, or shared auth context behavior changes.
Copy this file when you add tests for another shared frontend provider.
*/

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

const { postJson } = vi.hoisted(() => ({
  postJson: vi.fn(),
}));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return {
    ...actual,
    postJson,
  };
});

import { AuthProvider, useAuth } from "./auth";

function AuthStatus() {
  const { loading, user } = useAuth();
  if (loading) {
    return <p>Loading</p>;
  }
  return <p>{user ? user.username : "Anonymous"}</p>;
}

describe("AuthProvider", () => {
  it("loads the session only once during StrictMode startup", async () => {
    postJson.mockResolvedValueOnce({ user: null });

    render(
      <StrictMode>
        <AuthProvider>
          <AuthStatus />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("Anonymous")).toBeInTheDocument());
    expect(postJson).toHaveBeenCalledTimes(1);
    expect(postJson).toHaveBeenCalledWith("/auth/me");
  });
});
