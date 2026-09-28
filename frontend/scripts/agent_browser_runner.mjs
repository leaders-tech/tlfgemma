/*
This file runs one hidden Playwright browser scenario against the agent frontend.
Edit this file when hidden browser helper setup, viewport, or output shape changes.
Copy this runner pattern when you add another small local browser tool.
*/

import { chromium } from "@playwright/test";
import path from "node:path";
import process from "node:process";
import { pathToFileURL, fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(frontendRoot, "../..");
process.loadEnvFile(path.join(repoRoot, ".agent.env"));

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in .agent.env. Run make setup or update the root .agent.env file.`);
  }
  return value;
}

const scriptArg = process.argv[2];
if (!scriptArg) {
  throw new Error("Missing scenario path. Use: make abrowser SCRIPT=path/to/scenario.mjs");
}

const resolvedScript = path.isAbsolute(scriptArg) ? scriptArg : path.resolve(repoRoot, scriptArg);
const { default: runScenario } = await import(pathToFileURL(resolvedScript).href);

if (typeof runScenario !== "function") {
  throw new Error(`Scenario file must export default async function: ${resolvedScript}`);
}

const baseUrl = `http://${requireEnv("AGENT_FRONTEND_HOST")}:${requireEnv("AGENT_FRONTEND_PORT")}`;
const apiBaseUrl = `http://${requireEnv("AGENT_BACKEND_HOST")}:${requireEnv("AGENT_BACKEND_PORT")}/api`;
const viewport = {
  width: Number.parseInt(requireEnv("AGENT_BROWSER_WIDTH"), 10),
  height: Number.parseInt(requireEnv("AGENT_BROWSER_HEIGHT"), 10),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport });
const consoleErrors = [];
const httpErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});

page.on("response", (response) => {
  if (response.status() >= 400) {
    httpErrors.push({
      url: response.url(),
      status: response.status(),
    });
  }
});

try {
  const result = await runScenario({
    browser,
    page,
    baseUrl,
    apiBaseUrl,
    consoleErrors,
    httpErrors,
  });

  const payload = result && typeof result === "object" ? result : { result };
  console.log(
    JSON.stringify(
      {
        ...payload,
        consoleErrors,
        httpErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
