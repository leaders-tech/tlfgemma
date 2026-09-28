// Let staff inspect chats and admins reset history. Edit for review tools; copy for another staff page.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../app/auth";
import { postJson } from "../shared/api";
import type { History, Message, User, WsMessage } from "../shared/types";
import { HistoryList, mergeMessages } from "../features/chat/History";
export function ReviewPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]),
    [selected, setSelected] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [after, setAfter] = useState<number | null>(null),
    [before, setBefore] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false),
    [clearing, setClearing] = useState(false);
  const [reset, setReset] = useState(0);
  const revision = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void postJson<{ users: User[]; after: number | null }>("/review/users", { search })
      .then((data) => {
        if (!cancelled) {
          setUsers(data.users);
          setAfter(data.after);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);
  useEffect(() => {
    const receive = (event: Event) => {
      if (["history.cleared", "ws.ready"].includes((event as CustomEvent<WsMessage>).detail.type)) {
        revision.current++;
        setMessages([]);
        setReset((n) => n + 1);
      }
    };
    window.addEventListener("gemma.event", receive);
    return () => window.removeEventListener("gemma.event", receive);
  }, []);
  useEffect(() => {
    revision.current++;
    const version = revision.current;
    setMessages([]);
    setBefore(null);
    if (!selected) return;
    const load = () =>
      postJson<History>("/chat/history", { user_id: selected.id })
        .then((data) => {
          if (version === revision.current) {
            setMessages((old) => mergeMessages(old, data.messages));
            setBefore(data.before);
          }
        })
        .catch((e) => {
          if (version === revision.current) setError(e.message);
        });
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      revision.current++;
      window.clearInterval(timer);
    };
  }, [selected, reset]);
  return (
    <main className="review workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">TEACHER WORKSPACE</div>
          <h1>Review chats</h1>
        </div>
        {user?.roles.includes("admin") && (
          <button className="danger-outline" onClick={() => setConfirm(true)}>
            Clear all history
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {confirm && (
        <section role="dialog" aria-modal="true" aria-label="Clear all history" className="confirm">
          <h2>Clear everyone's history?</h2>
          <p>This permanently deletes all messages, stops active answers, and resets every message limit. Accounts stay signed in.</p>
          <button disabled={clearing} onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            className="danger"
            disabled={clearing}
            onClick={() => {
              setClearing(true);
              void postJson("/admin/clear", { confirm: "CLEAR ALL HISTORY" })
                .then(() => {
                  revision.current++;
                  setMessages([]);
                  setReset((n) => n + 1);
                  setConfirm(false);
                })
                .catch((e) => setError(e.message))
                .finally(() => setClearing(false));
            }}
          >
            {clearing ? "Clearing…" : "Delete all messages"}
          </button>
        </section>
      )}
      <div className="review-grid">
        <aside>
          <label htmlFor="search">Find a user</label>
          <input id="search" type="search" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="user-list">
            {users.map((item) => (
              <button className={selected?.id === item.id ? "selected" : ""} key={item.id} onClick={() => setSelected(item)}>
                <strong>{item.email}</strong>
                <small>{item.roles.join(", ") || "student"}</small>
              </button>
            ))}
          </div>
          {after && (
            <button
              onClick={() => {
                void postJson<{ users: User[]; after: number | null }>("/review/users", { search, after })
                  .then((data) => {
                    setUsers((old) => [...old, ...data.users]);
                    setAfter(data.after);
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              More users
            </button>
          )}
        </aside>
        <section className="review-history" aria-label="User history">
          {selected ? (
            <>
              <h2>{selected.email}</h2>
              <p className="muted">Read-only history · Updates every 5 seconds</p>
              {before && (
                <button
                  onClick={() => {
                    const version = revision.current;
                    void postJson<History>("/chat/history", { user_id: selected.id, before })
                      .then((data) => {
                        if (version === revision.current) {
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
              <HistoryList messages={messages} />
              {!messages.length && <p className="empty-note">No messages yet.</p>}
            </>
          ) : (
            <div className="empty-chat">
              <h2>A clear view of every conversation.</h2>
              <p>Select a user to review their requests and answers.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
