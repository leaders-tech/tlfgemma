// Test composer limits and live history. Edit for chat changes; copy for new chat flows.
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { AuthContext } from "../app/auth";
import { ChatPage } from "./ChatPage";
import { postJson } from "../shared/api";
vi.mock("../shared/api", () => ({
  postJson: vi.fn(),
  ApiError: class extends Error {
    status = 500;
  },
}));
const quota = { remaining: 60, next_available_at: null, server_time: new Date().toISOString() };
const message = {
  id: 1,
  user_id: 1,
  request_id: "id",
  prompt: "hello",
  answer: "first",
  status: "streaming",
  error: null,
  truncated: 0,
  version: 1,
  created_at: new Date().toISOString(),
};
function page() {
  return render(
    <AuthContext.Provider
      value={{
        user: { id: 1, email: "s@example.org", roles: [] },
        loading: false,
        error: "",
        status: "connected",
        login: vi.fn(),
        logout: vi.fn(),
        reloadUser: vi.fn(),
      }}
    >
      <ChatPage />
    </AuthContext.Provider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(postJson).mockImplementation(async (path) => (path === "/chat/quota" ? quota : { messages: [], before: null }));
});
it("allows overflow editing and counts Unicode code points", async () => {
  page();
  await screen.findByText("60");
  const input = screen.getByLabelText("Your message");
  fireEvent.change(input, { target: { value: "🦊".repeat(1001) } });
  expect(screen.getByText("-1 characters left")).toHaveClass("over");
  expect(screen.getByRole("button", { name: /Send message/ })).toBeDisabled();
  fireEvent.change(input, { target: { value: "🦊".repeat(1000) } });
  expect(screen.getByText("0 characters left")).toBeVisible();
  expect(screen.getByRole("button", { name: /Send message/ })).toBeEnabled();
});
it("merges stream versions and clears history", async () => {
  page();
  await screen.findByText("60");
  act(() =>
    window.dispatchEvent(
      new CustomEvent("gemma.event", { detail: { type: "chat.updated", message: { ...message, answer: "new answer", version: 2 }, quota } }),
    ),
  );
  act(() => window.dispatchEvent(new CustomEvent("gemma.event", { detail: { type: "chat.updated", message, quota } })));
  expect(screen.getByText("new answer")).toBeVisible();
  expect(screen.queryByText("first")).toBeNull();
  act(() => window.dispatchEvent(new CustomEvent("gemma.event", { detail: { type: "history.cleared" } })));
  await waitFor(() => expect(screen.queryByText("new answer")).toBeNull());
});
it("sends only the new text and an idempotency key", async () => {
  vi.mocked(postJson).mockImplementation(async (path) =>
    path === "/chat/send" ? { message, quota } : path === "/chat/quota" ? quota : { messages: [], before: null },
  );
  page();
  await screen.findByText("60");
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Send message/ }));
  await waitFor(() => expect(postJson).toHaveBeenCalledWith("/chat/send", { text: "hello", request_id: expect.any(String) }));
  await waitFor(() => expect(screen.getByLabelText("Your message")).toHaveValue(""));
});

it("refreshes stale history after reconnect", async () => {
  page();
  await screen.findByText("60");
  act(() => window.dispatchEvent(new CustomEvent("gemma.event", { detail: { type: "chat.updated", message, quota } })));
  expect(screen.getByText("first")).toBeVisible();
  act(() => window.dispatchEvent(new CustomEvent("gemma.event", { detail: { type: "ws.ready" } })));
  await waitFor(() => expect(screen.queryByText("first")).toBeNull());
});
it("does not overwrite a newer quota with an older stream event", async () => {
  page();
  await screen.findByText("60");
  const update = (remaining: number, server_time: string) =>
    window.dispatchEvent(new CustomEvent("gemma.event", { detail: { type: "chat.updated", message, quota: { ...quota, remaining, server_time } } }));
  act(() => update(58, "2099-01-01T00:00:02.000000+00:00"));
  act(() => update(59, "2099-01-01T00:00:01.000000+00:00"));
  expect(screen.getByText("58")).toBeVisible();
});
