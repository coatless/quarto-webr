import { test, expect } from '@playwright/test'
import path from 'node:path'
import { startServer } from '../_harness/serve.js'
import { renderFixture } from '../_harness/render.js'

let server
let baseURL

test.beforeAll(async () => {
  renderFixture('basic-cell')
  const started = await startServer(path.resolve('tests/_fixtures'))
  server = started.server
  // The server binds 127.0.0.1, so address it directly: `localhost` can resolve
  // to ::1 first and fail to connect.
  baseURL = `http://127.0.0.1:${started.port}`
})

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('webR boots and executes a cell', async ({ page }) => {
  await page.goto(`${baseURL}/basic-cell.html`)

  // The run button is disabled until webR finishes booting. Waiting on the
  // button rather than the status text works even when the startup message
  // is suppressed.
  const runButton = page.locator('#qwebr-button-run-1')
  await expect(runButton).toBeEnabled({ timeout: 120000 })

  await runButton.click()

  await expect(page.locator('#qwebr-output-code-area-1')).toContainText('[1] 2', {
    timeout: 60000,
  })
})

test('the status indicator reaches ready', async ({ page }) => {
  await page.goto(`${baseURL}/basic-cell.html`)
  await expect(page.locator('#qwebr-status-message-text')).toHaveText(/Ready/, {
    timeout: 120000,
  })
})
