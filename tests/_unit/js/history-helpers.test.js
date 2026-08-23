import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { loadBrowserScript } from '../../_harness/load-globals.js'

// These ids must exist before the script runs; it wires onclick handlers to
// them at load time and throws on null otherwise.
const SEED = `
  <div id="qwebr-history-modal"></div>
  <button id="qwebrRHistoryButton"></button>
  <span id="qwebr-command-history-close-btn"></span>
  <button id="qwebr-download-history-btn"></button>
  <div id="qwebr-command-history-contents"></div>
`

const context = loadBrowserScript('qwebr-document-history.js', SEED)

describe('formatDateTime', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 23, 9, 5, 3))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('pads every component to two digits', () => {
    expect(context.formatDateTime()).toBe('2026-08-23-09-05-03')
  })
})

describe('safeFileName', () => {
  it('replaces characters that are unsafe in a filename', () => {
    // Title exercises every character the source's replace class targets
    // (_extensions/webr/qwebr-document-history.js: /[\\/:\*\?! "<>\|]/g),
    // including the space, which is the most likely unsafe character to
    // appear in a real page title.
    context.document.title = 'Test: "webR"/demo? \\*!<>|'
    const result = context.safeFileName()
    expect(result).toMatch(/^Rhistory-/)
    expect(result).not.toMatch(/[\\/:*?! "<>|]/)
  })
})
