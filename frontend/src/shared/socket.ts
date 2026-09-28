/*
This file keeps the small frontend websocket client with reconnect logic.
Edit this file when websocket connection flow or client-side message handling changes.
Copy this file as a starting point when you add another small websocket client helper.
*/

import type { WsMessage } from "./types";
import { getWsUrl } from "./api";

export type SocketStatus = "idle" | "connecting" | "connected" | "disconnected";

type CreateSocketOptions = {
  onMessage: (message: WsMessage) => void;
  onStatus: (status: SocketStatus) => void;
  onSessionEnded?: () => void;
};

export function createUserSocket(options: CreateSocketOptions) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: number | null = null;
  let reconnectDelayMs = 1500;

  const connect = () => {
    options.onStatus("connecting");
    ws = new WebSocket(getWsUrl());
    ws.onopen = () => {
      reconnectDelayMs = 1500;
      options.onStatus("connected");
    };
    ws.onmessage = (event) => {
      if (!stopped) options.onMessage(JSON.parse(event.data) as WsMessage);
    };
    ws.onerror = () => console.warn("WebSocket error.");
    ws.onclose = (event) => {
      if (event?.code === 1008) {
        stopped = true;
        options.onSessionEnded?.();
      }
      options.onStatus("disconnected");
      if (!stopped) {
        reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
      }
    };
  };

  connect();

  return {
    sendPing() {
      ws?.send(JSON.stringify({ type: "ping" }));
    },
    stop() {
      stopped = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    },
  };
}
