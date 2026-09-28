/*
This file configures the frontend build, test setup, and PWA plugin.
Edit this file when Vite plugins, frontend test setup, or build settings change.
Copy a config pattern here when you add another shared frontend build setting.
*/
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig } from "vitest/config";
import { createLogger, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var proxyTarget = (_b = env.VITE_DEV_PROXY_TARGET) === null || _b === void 0 ? void 0 : _b.trim();
    var baseLogger = createLogger();
    var logger = __assign(__assign({}, baseLogger), { error: function (message, options) {
            var isKnownWsDisconnect = (message.includes("ws proxy error:") || message.includes("ws proxy socket error:")) &&
                (message.includes("EPIPE") || message.includes("ECONNRESET"));
            if (isKnownWsDisconnect) {
                return;
            }
            baseLogger.error(message, options);
        } });
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
