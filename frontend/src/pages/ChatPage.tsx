// Show the private chat and quota. Edit for chat behavior; copy page structure for another workspace.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../app/auth";
import { ApiError, postJson } from "../shared/api";
import type { Conversation, History, Message, Quota, WsMessage } from "../shared/types";
import { ModelBadge } from "../features/chat/ModelBadge";
import { HistoryList, mergeMessages } from "../features/chat/History";
export function ChatPage({ conversation }: { conversation?: Conversation }) {
  const { status } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [quota, setQuotaState] = useState<Quota | null>(null);
  const setQuota = useCallback(
    (incoming: Quota) => setQuotaState((current) => (!current || incoming.server_time >= current.server_time ? incoming : current)),
    [],
  );
  const [before, setBefore] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const load = useCallback(async () => {
    const version = epoch.current;
    try {
      const [history, remaining] = await Promise.all([
        postJson<History>("/chat/history", conversation ? { conversation_id: conversation.id } : {}),
        postJson<Quota>("/chat/quota"),
      ]);
      if (version !== epoch.current) return;
      setMessages((previous) => mergeMessages(previous, history.messages));
      setBefore(history.before);
      setQuota(remaining);
    } catch (e) {
      if (version === epoch.current) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const receive = (event: Event) => {
      const data = (event as CustomEvent<WsMessage>).detail;
      if (data.type === "chat.updated") {
        if (!conversation || data.message.conversation_id === conversation.id) setMessages((previous) => mergeMessages(previous, [data.message]));
        setQuota(data.quota);
      }
      if (data.type === "ws.ready" || data.type === "history.cleared") {
        epoch.current++;
        pending.current = null;
        setMessages([]);
        setBefore(null);
        setError("");
        void load();
      }
    };
    window.addEventListener("gemma.event", receive);
    const timer = window.setInterval(() => {
      void postJson<Quota>("/chat/quota")
        .then(setQuota)
        .catch(() => {});
    }, 10000);
    return () => {
      epoch.current++;
      window.removeEventListener("gemma.event", receive);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const history = bottom.current?.parentElement;
    if (follow.current && history) history.scrollTo?.({ top: history.scrollHeight, behavior: "smooth" });
  }, [messages]);
  const remaining = 1000 - Array.from(text).length;
  const active = quota?.active || messages.some((item) => item.status === "streaming");
  async function submit() {
    if (conversation?.archived || sending || active || remaining < 0 || !text.trim()) return;
    const version = epoch.current;
    if (!pending.current || pending.current.text !== text) pending.current = { text, id: crypto.randomUUID() };
    setSending(true);
    setError("");
    try {
      const data = await postJson<{ message: Message; quota: Quota }>("/chat/send", {
        text,
        request_id: pending.current.id,
        ...(conversation ? { conversation_id: conversation.id } : {}),
      });
      if (version !== epoch.current) return;
      setMessages((previous) => mergeMessages(previous, [data.message]));
      setQuota(data.quota);
      setText("");
      pending.current = null;
      follow.current = true;
    } catch (e) {
      if (version === epoch.current) {
        setError((e as Error).message);
        if (e instanceof ApiError && e.status < 500) pending.current = null;
        void load();
      }
    } finally {
      setSending(false);
    }
  }
  return (
    <main className="workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1>My chat</h1>
          {conversation && (
            <p className="muted">
              {conversation.title}
              {conversation.archived ? " · Archived · Read only" : ""}
            </p>
          )}
        </div>
        <ModelBadge />
      </div>
      <div className="limits">
        <span>
          <strong>{quota?.remaining ?? "—"}</strong> / 60 messages left
        </span>
        <span>
          Rolling 60-minute limit
          {quota?.remaining === 0 && quota.next_available_at ? ` · Next message at ${new Date(quota.next_available_at).toLocaleTimeString()}` : ""}
        </span>
        <span className={status === "connected" ? "connection" : "connection offline"}>{status === "connected" ? "Connected" : "Reconnecting…"}</span>
      </div>
      <section
        className="conversation"
        aria-label="Chat history"
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {before && (
          <button
            className="text-button older"
            onClick={() => {
              const version = epoch.current;
              follow.current = false;
              void postJson<History>("/chat/history", { before, ...(conversation ? { conversation_id: conversation.id } : {}) })
                .then((data) => {
                  if (version === epoch.current) {
                    setMessages((old) => mergeMessages(old, data.messages));
                    setBefore(data.before);
                  }
                })
                .catch((e) => setError(e.message));
            }}
          >
            Load older messages
          </button>
        )}
        {loading ? (
          <p className="empty-note">Loading history…</p>
        ) : (
          !messages.length && (
            <div className="empty-chat">
              <div className="empty-symbol">✳</div>
              <h2>What will you explore?</h2>
              <p>
                Try an idea, ask a question, or work through a problem.
                <br />
                Each message is a fresh start.
              </p>
            </div>
          )
        )}
        <HistoryList messages={messages} />
        <div ref={bottom} />
      </section>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <label className="sr-only" htmlFor="message">
          Your message
        </label>
        <textarea
          id="message"
          placeholder="Ask Gemma something…"
          value={text}
          disabled={sending || !!conversation?.archived}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="composer-bottom">
          <span className={remaining < 0 ? "character-count over" : "character-count"} aria-live="polite">
            {remaining.toLocaleString()} characters left
          </span>
          <button
            className="primary"
            disabled={
              !!conversation?.archived || sending || active || remaining < 0 || !text.trim() || !quota || quota.remaining === 0 || status !== "connected"
            }
          >
            {sending ? "Sending…" : active ? "Writing…" : "Send message"}
            <span aria-hidden="true"> ↑</span>
          </button>
        </div>
      </form>
      <p className="context-note">Only your latest message is sent to Gemma. Answers are limited to 1,000 characters.</p>
    </main>
  );
}
