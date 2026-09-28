// Define API data. Edit when backend responses change; copy types for new features.
export type User = { id: number; email: string; roles: string[] };
export type Message = {
  id: number;
  user_id: number;
  request_id: string;
  prompt: string;
  model: string;
  answer: string;
  status: "streaming" | "complete" | "error" | "interrupted";
  error: string | null;
  truncated: number;
  version: number;
  created_at: string;
};
export type Quota = { remaining: number; next_available_at: string | null; server_time: string };
export type History = { messages: Message[]; before: number | null };
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export type ModelSettings = { model: string; default_model: string };
export type WsMessage =
  | { type: "model.changed"; model: string }
  | { type: "ws.ready" | "pong" | "history.cleared" }
  | { type: "chat.updated"; message: Message; quota: Quota };
