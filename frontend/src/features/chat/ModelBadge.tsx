// Show the shared model and keep it current. Edit for model labels; copy for another live setting display.
import { useEffect, useState } from "react";
import { postJson } from "../../shared/api";
import type { ModelSettings, WsMessage } from "../../shared/types";
export function ModelBadge() {
  const [model, setModel] = useState("");
  useEffect(() => {
    let stopped = false;
    let version = 0;
    const load = () => {
      const current = ++version;
      void postJson<ModelSettings>("/chat/model")
        .then((data) => {
          if (!stopped && current === version) setModel(data.model);
        })
        .catch(() => {
          if (!stopped && current === version) setModel("");
        });
    };
    const receive = (event: Event) => {
      const data = (event as CustomEvent<WsMessage>).detail;
      if (data.type === "model.changed") {
        version++;
        setModel(data.model);
      }
      if (data.type === "ws.ready") load();
    };
    load();
    window.addEventListener("gemma.event", receive);
    return () => {
      stopped = true;
      window.removeEventListener("gemma.event", receive);
    };
  }, []);
  return (
    <div className="model-badge" aria-label="Current model">
      <span className="gemma-dot" />
      <span>{model || "Model unavailable"}</span>
    </div>
  );
}
