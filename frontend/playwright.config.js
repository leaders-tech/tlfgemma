/*
This file configures Playwright e2e tests and the temporary dev servers they use.
Edit this file when browser test setup, ports, or e2e server env values change.
Copy a config pattern here when you add another shared e2e setting.
*/
var _a, _b;
import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";
var frontendRoot = path.dirname(fileURLToPath(import.meta.url));
var repoRoot = path.resolve(frontendRoot, "..");
process.loadEnvFile(path.join(repoRoot, ".env"));
function requireEnv(name) {
    var _a;
    var value = (_a = process.env[name]) === null || _a === void 0 ? void 0 : _a.trim();
    if (!value) {
        throw new Error("Missing ".concat(name, " in .env. Run make setup or update the root .env file."));
    }
    return value;
}
var backendHost = requireEnv("E2E_BACKEND_HOST");
var backendPort = requireEnv("E2E_BACKEND_PORT");
var frontendHost = requireEnv("E2E_FRONTEND_HOST");
var frontendPort = requireEnv("E2E_FRONTEND_PORT");
var backendUrl = "http://".concat(backendHost, ":").concat(backendPort);
var frontendUrl = "http://".concat(frontendHost, ":").concat(frontendPort);
var dbDir = ((_a = process.env.E2E_DB_DIR) === null || _a === void 0 ? void 0 : _a.trim()) || os.tmpdir();
var dbPath = ((_b = process.env.E2E_DB_PATH) === null || _b === void 0 ? void 0 : _b.trim()) || path.join(dbDir, "templatepwa-e2e-".concat(Date.now(), "-").concat(process.pid, ".sqlite3"));
var uvCacheDir = path.join(os.tmpdir(), "templatepwa-uv-cache");
export default defineConfig({
    testDir: "./tests/e2e",
    use: {
        baseURL: frontendUrl,
    },
    webServer: [
        {
            command: "uv run python -m backend.main",
            cwd: repoRoot,
            url: "".concat(backendUrl, "/api/health"),
            reuseExistingServer: !process.env.CI,
            env: {
                APP_MODE: "dev",
                APP_HOST: backendHost,
                APP_PORT: backendPort,
                DB_PATH: dbPath,
                COOKIE_SECRET: requireEnv("E2E_COOKIE_SECRET"),
                FRONTEND_ORIGIN: frontendUrl,
                UV_CACHE_DIR: uvCacheDir,
            },
        },
        {
            command: "npm run dev -- --host ".concat(frontendHost, " --port ").concat(frontendPort),
            cwd: frontendRoot,
            url: frontendUrl,
            reuseExistingServer: !process.env.CI,
            env: {
                VITE_BACKEND_URL: "/api",
                VITE_DEV_PROXY_TARGET: backendUrl,
            },
        },
    ],
});
