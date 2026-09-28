/*
This file runs the same Playwright browser flows against the Docker deployment stack.
Edit this file when docker e2e URLs, env values, or stack startup rules change.
Copy a config pattern here when you add another Playwright target environment.
*/
var _a;
import { defineConfig } from "@playwright/test";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
var frontendRoot = path.dirname(fileURLToPath(import.meta.url));
var repoRoot = path.resolve(frontendRoot, "..");
process.loadEnvFile(path.join(repoRoot, ".docker.env"));
var frontendUrl = (_a = process.env.E2E_FRONTEND_URL) === null || _a === void 0 ? void 0 : _a.trim();
if (!frontendUrl) {
    throw new Error("Missing E2E_FRONTEND_URL in .docker.env. Run make setup or update the root .docker.env file.");
}
export default defineConfig({
    testDir: "./tests/e2e",
    use: {
        baseURL: frontendUrl,
    },
});
