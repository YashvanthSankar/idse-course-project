import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3200",
    trace: "retain-on-failure",
    // the first-visit site guide would cover every page; e2e/guide.spec.ts tests it with a fresh browser
    storageState: { cookies: [], origins: [{ origin: "http://localhost:3200", localStorage: [{ name: "site.guide.v1", value: "1" }] }] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL ?? "chrome" } }],
  webServer: {
    command: "pnpm dev --port 3200",
    url: "http://localhost:3200",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
