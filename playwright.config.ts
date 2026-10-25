import "dotenv/config";
import { defineConfig } from "@playwright/test";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 90000,
  },
});
