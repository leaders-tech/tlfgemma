// Test conversation navigation and archives. Edit for sidebar behavior; copy for similar navigation tests.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { ChatWorkspace } from "./ChatWorkspace";
import { postJson } from "../shared/api";
vi.mock("../shared/api", () => ({ postJson: vi.fn() }));
vi.mock("./ChatPage", () => ({
  ChatPage: ({ conversation }: { conversation: { id: number; archived: number } }) => (
    <div>
      Conversation {conversation.id} {conversation.archived ? "read only" : "editable"}
    </div>
  ),
}));
beforeEach(() => vi.clearAllMocks());
it("selects conversations and archives without deleting them", async () => {
  const chats = [
    { id: 1, title: "Math", archived: 0 },
    { id: 2, title: "Science", archived: 0 },
  ];
  vi.mocked(postJson).mockImplementation(async (path) => {
    if (path === "/conversations/archive") chats[0].archived = 1;
    return { conversations: chats.map((chat) => ({ ...chat })) };
  });
  render(<ChatWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: "Open chat: Science", exact: true }));
  expect(screen.getByText("Conversation 2 editable")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open chat: Math", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Archive Math" }));
  await screen.findByText("Conversation 1 read only");
  expect(postJson).toHaveBeenCalledWith("/conversations/archive", { conversation_id: 1, archived: true });
  expect(screen.getByRole("button", { name: "Restore Math" })).toBeVisible();
});
it("creates and selects a new chat", async () => {
  const chats = [{ id: 1, title: "Math", archived: 0 }];
  vi.mocked(postJson).mockImplementation(async (path) => {
    if (path === "/conversations/create") {
      const conversation = { id: 2, title: "New chat", archived: 0 };
      chats.push(conversation);
      return { conversation };
    }
    return { conversations: [...chats] };
  });
  render(<ChatWorkspace />);
  await screen.findByText("Conversation 1 editable");
  fireEvent.click(screen.getByRole("button", { name: "New chat", exact: true }));
  await waitFor(() => expect(screen.getByText("Conversation 2 editable")).toBeVisible());
});
