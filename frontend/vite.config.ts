/*
This file configures the frontend build, test setup, and PWA plugin.
Edit this file when Vite plugins, frontend test setup, or build settings change.
Copy a config pattern here when you add another shared frontend build setting.
*/

import { defineConfig } from "vitest/config";
import { createLogger, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim();
  const baseLogger = createLogger();
  const logger = {
    ...baseLogger,
    error(message: string, options?: Parameters<typeof baseLogger.error>[1]) {
      const isKnownWsDisconnect =
        (message.includes("ws proxy error:") || message.includes("ws proxy socket error:")) && (message.includes("EPIPE") || message.includes("ECONNRESET"));

      if (isKnownWsDisconnect) {
        return;
      }
      baseLogger.error(message, options);
    },
  };

  return {
    customLogger: logger,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Template PWA",
          short_name: "TemplatePWA",
          description: "Small starter app for school projects.",
          theme_color: "#0e1a2b",
          background_color: "#eff6ff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/pwa-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "/pwa-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },
      }),
    ],
    server: proxyTarget
      ? {
          proxy: {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
            },
            "/ws": {
              target: proxyTarget,
              changeOrigin: true,
              ws: true,
            },
          },
        }
      : undefined,
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./vitest.setup.ts",
      exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    },
  };
});
