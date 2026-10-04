import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: 'bunx wrangler dev --config tests/e2e/wrangler.jsonc --local --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 60000 },
  reporter: 'list'
})
