import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { renderFixture, normalizeVersion } from '../_harness/render.js'

const FIXTURE_DIR = path.resolve('tests/_fixtures')

// The version the fixtures pin. Deliberately implausible as a real webR
// release so it can never collide with whatever the release bot writes into
// `baseVersionWebR`. Nothing here asserts the *embedded* version: that string
// is rewritten on every bump PR.
const PINNED_VERSION = '9.8.7'
const PINNED_BASE_URL = 'https://cdn.example.test/webr-mirror/'
const PINNED_SERVICE_WORKER_URL = 'https://cdn.example.test/webr-workers/'

// Every versioned webR base URL the document ended up pointing at.
const versionedBaseUrls = (html) => [
  ...new Set(html.match(/https:\/\/webr\.r-wasm\.org\/v\d+\.\d+\.\d+\//g) ?? []),
]

// The filter writes these next to the rendered document, but only when the
// service-worker channel is requested.
const WORKER_FILES = ['webr-serviceworker.js', 'webr-worker.js']
const workerPath = (name) => path.join(FIXTURE_DIR, name)
const removeWorkerFiles = () =>
  WORKER_FILES.forEach((name) => rmSync(workerPath(name), { force: true }))

/**
 * Render a fixture and hand back stderr alongside the HTML.
 * `renderFixture` swallows stderr, and the both-options-set warning is only
 * observable there, so this one path needs its own runner.
 */
function renderCapturingStderr(name) {
  const result = spawnSync('quarto', ['render', `${name}.qmd`, '--to', 'html'], {
    cwd: FIXTURE_DIR,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`quarto render ${name}.qmd failed:\n${result.stderr}`)
  }
  return {
    html: readFileSync(path.join(FIXTURE_DIR, `${name}.html`), 'utf8'),
    stderr: result.stderr,
  }
}

describe('webr.version', () => {
  let html
  beforeAll(() => {
    // Doubles as the control for the service-worker file emission below:
    // a document that does not ask for the service-worker channel must not
    // leave worker files behind. Kept in this block so the removal happens
    // before any render in this file writes them.
    removeWorkerFiles()
    html = renderFixture('meta-version')
  })

  it('loads webR from the version named in the document', () => {
    expect(html).toContain(`"baseURL": "https://webr.r-wasm.org/v${PINNED_VERSION}/"`)
  })

  it('replaces the embedded version rather than adding to it', () => {
    expect(versionedBaseUrls(html)).toStrictEqual([
      `https://webr.r-wasm.org/v${PINNED_VERSION}/`,
    ])
  })

  // The three below are non-interference guards, not assertions about version
  // handling: they pass for any fixture that does not select the service-worker
  // channel. They exist to catch a change to `version` that disturbs unrelated
  // settings. Read them that way — a green run here says nothing about whether
  // the version was applied. The two assertions above cover that.
  it('setting a version does not disturb the channel type', () => {
    expect(html).toContain('"channelType": "ChannelType.Automatic"')
  })

  it('setting a version does not populate the service worker URL', () => {
    expect(html).toContain('"serviceWorkerUrl": ""')
  })

  it('setting a version does not trigger worker file generation', () => {
    WORKER_FILES.forEach((name) => expect(existsSync(workerPath(name))).toBe(false))
  })
})

describe('webr.base-url', () => {
  let html
  beforeAll(() => {
    html = renderFixture('meta-base-url')
  })

  it('loads webR from the base URL named in the document, verbatim', () => {
    expect(html).toContain(`"baseURL": "${PINNED_BASE_URL}"`)
  })

  it('stops pointing at the default webR host entirely', () => {
    expect(versionedBaseUrls(html)).toStrictEqual([])
  })
})

describe('webr.version and webr.base-url together', () => {
  let html
  let stderr
  let controlStderr
  beforeAll(() => {
    ;({ html, stderr } = renderCapturingStderr('meta-version-and-base-url'))
    ;({ stderr: controlStderr } = renderCapturingStderr('meta-base-url'))
  })

  it('warns that both were specified', () => {
    expect(stderr).toContain('Please do not specify both `base-url` and `version`')
  })

  it('does not warn when only base-url is specified', () => {
    expect(controlStderr).not.toContain('Please do not specify both')
  })

  it('lets base-url win', () => {
    expect(html).toContain(`"baseURL": "${PINNED_BASE_URL}"`)
  })

  it('discards the version', () => {
    expect(html).not.toContain(PINNED_VERSION)
    expect(versionedBaseUrls(html)).toStrictEqual([])
  })
})

describe('webr.channel-type: service-worker', () => {
  let html
  beforeAll(() => {
    // Removed first so the assertions below cannot pass on stale files left
    // by an earlier run.
    removeWorkerFiles()
    html = renderFixture('meta-service-worker')
  })

  it('emits the service worker channel type', () => {
    expect(html).toContain('"channelType": "ChannelType.ServiceWorker"')
  })

  it('carries service-worker-url into the emitted config', () => {
    expect(html).toContain(`"serviceWorkerUrl": "${PINNED_SERVICE_WORKER_URL}"`)
  })

  // The filter also drops copies of these two files into _extensions/webr/.
  // That is existing behaviour, is gitignored, and is not asserted here.
  it.each(WORKER_FILES)('writes %s next to the document', (name) => {
    expect(existsSync(workerPath(name))).toBe(true)
  })

  it.each(WORKER_FILES)('points %s at the versioned webR base URL', (name) => {
    const contents = normalizeVersion(readFileSync(workerPath(name), 'utf8'))
    expect(contents).toBe(`importScripts('https://webr.r-wasm.org/vX.Y.Z/${name}');\n`)
  })
})
