// Display immutable chat exchanges. Edit for history layout; copy for similar activity lists.
import { useState } from "react";
import type { Message } from "../../shared/types";
import { Answer } from "./Answer";
export function mergeMessages(current: Message[], incoming: Message[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) if (!map.has(item.id) || map.get(item.id)!.version <= item.version) map.set(item.id, item);
  return [...map.values()].sort((a, b) => a.id - b.id);
}
export function HistoryList({ messages }: { messages: Message[] }) {
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {messages.map((item) => (
        <article className="exchange" key={item.id}>
          <div className="message-label">
            YOU <time>{new Date(item.created_at).toLocaleString()}</time>
          </div>
          <div className="prompt">{item.prompt}</div>
          <div className="answer">
            {item.model && <div className="answer-model">{item.model}</div>}
            <div className="message-label">
              <span className="gemma-dot" />
              GEMMA{" "}
              <span className="answer-status">
                {item.status === "streaming" ? "Writing…" : item.truncated ? "Character limit reached" : item.status === "complete" ? "" : "Incomplete"}
              </span>
            </div>
            {item.answer ? (
              <Answer text={item.answer} />
            ) : item.status === "streaming" ? (
              <div className="thinking">
                Thinking<span>…</span>
              </div>
            ) : null}
            {item.error && (
              <p className="error" role="alert">
                {item.error}
                {!item.answer && " This attempt does not use your limit."}
              </p>
            )}
            {!!item.answer && (
              <button
                className="copy-button"
                onClick={() => {
                  void navigator.clipboard.writeText(item.answer).then(
                    () => {
                      setCopied(item.id);
                      setError("");
                    },
                    () => setError("Could not copy. Please select and copy the text."),
                  );
                }}
              >
                {copied === item.id ? "Copied" : "Copy raw"}
              </button>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
