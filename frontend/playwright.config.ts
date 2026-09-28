/*
This file configures Playwright e2e tests and the temporary dev servers they use.
Edit this file when browser test setup, ports, or e2e server env values change.
Copy a config pattern here when you add another shared e2e setting.
*/

import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendRoot, "..");
process.loadEnvFile(path.join(repoRoot, ".env"));

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .env. Run make setup or update the root .env file.`);
  }
  return value;
}

const backendHost = requireEnv("E2E_BACKEND_HOST");
const backendPort = requireEnv("E2E_BACKEND_PORT");
const frontendHost = requireEnv("E2E_FRONTEND_HOST");
const frontendPort = requireEnv("E2E_FRONTEND_PORT");
const backendUrl = `http://${backendHost}:${backendPort}`;
const frontendUrl = `http://${frontendHost}:${frontendPort}`;
const dbDir = process.env.E2E_DB_DIR?.trim() || os.tmpdir();
const dbPath = process.env.E2E_DB_PATH?.trim() || path.join(dbDir, `templatepwa-e2e-${Date.now()}-${process.pid}.sqlite3`);
const uvCacheDir = path.join(os.tmpdir(), "templatepwa-uv-cache");

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: frontendUrl,
  },
  webServer: [
    {
      command: "uv run python -m backend.main",
      cwd: repoRoot,
      url: `${backendUrl}/api/health`,
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
      command: `npm run dev -- --host ${frontendHost} --port ${frontendPort}`,
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
