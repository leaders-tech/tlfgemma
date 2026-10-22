// Organize personal chats and archives. Edit for navigation; copy for another sidebar workspace.
import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "../shared/api";
import type { Conversation, WsMessage } from "../shared/types";
import { ChatPage } from "./ChatPage";

export function ChatWorkspace() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const initialChat = useRef<Promise<unknown> | null>(null);
  const load = useCallback(async () => {
    const version = ++revision.current;
    try {
      let data = await postJson<{ conversations: Conversation[] }>("/conversations/list");
      if (!data.conversations.length) {
        if (!initialChat.current)
          initialChat.current = postJson("/conversations/create").finally(() => {
            initialChat.current = null;
          });
        await initialChat.current;
        data = await postJson<{ conversations: Conversation[] }>("/conversations/list");
      }
      if (version !== revision.current) return;
      setChats(data.conversations);
      setSelected((old) =>
        data.conversations.some((chat) => chat.id === old) ? old : (data.conversations.find((chat) => !chat.archived)?.id ?? data.conversations[0]?.id ?? null),
      );
    } catch (e) {
      if (version === revision.current) setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const receive = (event: Event) => {
      const data = (event as CustomEvent<WsMessage>).detail;
      if (["conversations.changed", "history.cleared", "ws.ready"].includes(data.type) || (data.type === "chat.updated" && data.message.status !== "streaming"))
        void load();
    };
    window.addEventListener("gemma.event", receive);
    return () => {
      revision.current++;
      window.removeEventListener("gemma.event", receive);
    };
  }, [load]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const data = await postJson<{ conversation: Conversation }>("/conversations/create");
      await load();
      setSelected(data.conversation.id);
      setArchived(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive(chat: Conversation) {
    setBusy(true);
    setError("");
    try {
      await postJson("/conversations/archive", { conversation_id: chat.id, archived: !chat.archived });
      await load();
      setArchived(!chat.archived);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const current = chats.find((chat) => chat.id === selected);
  return (
    <div className="chat-layout">
      <aside className="chat-sidebar" aria-label="Conversations">
        <button className="primary" disabled={busy} onClick={() => void create()}>
          New chat
        </button>
        <div className="chat-tabs">
          <button aria-pressed={!archived} onClick={() => setArchived(false)}>
            Chats
          </button>
          <button aria-pressed={archived} onClick={() => setArchived(true)}>
            Archived
          </button>
        </div>
        <div className="chat-list">
          {chats
            .filter((chat) => !!chat.archived === archived)
            .map((chat) => (
              <div className="chat-list-row" key={chat.id}>
                <button
                  className={selected === chat.id ? "selected" : ""}
                  aria-label={`Open chat: ${chat.title}`}
                  aria-current={selected === chat.id ? "page" : undefined}
                  onClick={() => setSelected(chat.id)}
                >
                  {chat.title}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  aria-label={`${chat.archived ? "Restore" : "Archive"} ${chat.title}`}
                  onClick={() => void archive(chat)}
                >
                  {chat.archived ? "Restore" : "Archive"}
                </button>
              </div>
            ))}
        </div>
        {!chats.some((chat) => !!chat.archived === archived) && <p className="muted">{archived ? "No archived chats." : "No chats yet."}</p>}
        <p className="muted">All chats share the same message limit.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </aside>
      {current ? (
        <ChatPage key={current.id} conversation={current} />
      ) : (
        <main className="workspace">
          <h1>My chat</h1>
          <p>Loading chats…</p>
        </main>
      )}
    </div>
  );
}
