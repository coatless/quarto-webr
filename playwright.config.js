import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/_e2e',
  timeout: 180000,
  expect: { timeout: 120000 },
  retries: 1,
  use: { headless: true },
})
