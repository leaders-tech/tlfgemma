/*
This file tests the shared browser API helper and its path-based request contract.
Edit this file when API base paths or websocket URL rules change.
Copy this file when you add tests for another small shared browser helper.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

describe("shared api helper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("prefixes JSON requests with the configured API base path once", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "/api/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { saved: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { postJson } = await import("./api");
    const data = await postJson<{ saved: boolean }>("/notes/list");

    expect(data).toEqual({ saved: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes/list",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("builds websocket URLs from the current page origin and keeps the /ws path", async () => {
    const { getWsUrl } = await import("./api");
    const wsUrl = new URL(getWsUrl());

    expect(wsUrl.host).toBe(window.location.host);
    expect(wsUrl.pathname).toBe("/ws");
    expect(wsUrl.protocol).toBe(window.location.protocol === "https:" ? "wss:" : "ws:");
  });
});
