import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderFixture } from '../_harness/render.js'

const FIXTURE_DIR = path.resolve('tests/_fixtures')

// Pre-quoted in the filter and appended after whatever the document asks for.
const DEFAULT_REPO = 'https://repo.r-wasm.org/'
const CUSTOM_REPOS = [
  'https://example.test/webr-repo-one/',
  'https://example.test/webr-repo-two/',
]

/**
 * Pull one `globalThis.<name> = <value>;` line out of the emitted
 * document-settings block. Returned verbatim, so quoting is observable.
 */
function setting(html, name) {
  const match = html.match(new RegExp(`globalThis\\.${name} = (.*);$`, 'm'))
  if (!match) throw new Error(`document setting ${name} was not emitted`)
  return match[1]
}

const repoList = (html) =>
  JSON.parse(setting(html, 'qwebrPackageRepoURLS').replace(/'/g, '"'))
const packageList = (html) =>
  JSON.parse(setting(html, 'qwebrInstallRPackagesList').replace(/'/g, '"'))
// The resolved option table for each cell, in document order.
const cellOptions = (html) =>
  JSON.parse(setting(html, 'qwebrCellDetails')).map((cell) => cell.options)

const fixtureSource = (name) =>
  readFileSync(path.join(FIXTURE_DIR, `${name}.qmd`), 'utf8')

// Fixtures double as each other's controls: each one sets a single group of
// `webr:` keys, so any other group is at its built-in default there.
//   meta-cell-options -> control for messages, repos and packages
//   meta-repos        -> control for cell options
const doc = {}
beforeAll(() => {
  for (const name of [
    'meta-messages',
    'meta-messages-header',
    'meta-repos',
    'meta-autoload',
    'meta-cell-options',
  ]) {
    doc[name] = renderFixture(name)
  }
})

describe('webr.show-startup-message', () => {
  it('leaves the startup message on when the document says nothing', () => {
    expect(setting(doc['meta-cell-options'], 'qwebrShowStartupMessage')).toBe('true')
  })

  it('turns the startup message off when the document asks it to', () => {
    expect(setting(doc['meta-messages'], 'qwebrShowStartupMessage')).toBe('false')
  })

  it('does not touch the header message', () => {
    // Both fixtures emit `false`, but only one of them mentions the key, so
    // this pins that show-startup-message is not quietly driving the header.
    expect(setting(doc['meta-messages'], 'qwebrShowHeaderMessage')).toBe('false')
    expect(setting(doc['meta-cell-options'], 'qwebrShowHeaderMessage')).toBe('false')
  })
})

describe('webr.show-header-message', () => {
  it('turns the header message on when the document asks it to', () => {
    expect(setting(doc['meta-messages-header'], 'qwebrShowHeaderMessage')).toBe('true')
    expect(setting(doc['meta-cell-options'], 'qwebrShowHeaderMessage')).toBe('false')
  })

  // The forcing below is only meaningful while the fixture asks for the
  // opposite. Guard the fixture so a later edit cannot make it vacuous.
  it('is asserted against a fixture that explicitly disables the startup message', () => {
    expect(fixtureSource('meta-messages-header')).toContain('show-startup-message: false')
    expect(fixtureSource('meta-messages')).toContain('show-startup-message: false')
  })

  it('forces the startup message back on, overriding the document', () => {
    // meta-messages and meta-messages-header both set
    // `show-startup-message: false`; the only difference between them is
    // `show-header-message: true`, and the emitted value flips because of it.
    expect(setting(doc['meta-messages'], 'qwebrShowStartupMessage')).toBe('false')
    expect(setting(doc['meta-messages-header'], 'qwebrShowStartupMessage')).toBe('true')
  })
})

describe('webr.repos', () => {
  it('carries every repository named in the document', () => {
    expect(repoList(doc['meta-repos'])).toEqual(expect.arrayContaining(CUSTOM_REPOS))
    expect(repoList(doc['meta-cell-options'])).toEqual([DEFAULT_REPO])
  })

  it('appends the default webR repository after them', () => {
    expect(repoList(doc['meta-repos'])).toEqual([...CUSTOM_REPOS, DEFAULT_REPO])
  })

  it('single-quotes each URL in the emitted array', () => {
    const quoted = [...CUSTOM_REPOS, DEFAULT_REPO].map((url) => `'${url}'`).join(', ')
    expect(setting(doc['meta-repos'], 'qwebrPackageRepoURLS')).toBe(`[${quoted}]`)
  })
})

describe('webr.autoload-packages', () => {
  // The filter only reads this key inside the `packages` branch, so the
  // fixture has to request a package for it to be honoured. Verified by
  // rendering a throwaway document that set `autoload-packages: false` and
  // no `packages`: it still emitted `qwebrAutoloadRPackages = true`.
  it('stops autoloading when the document sets it false', () => {
    expect(setting(doc['meta-autoload'], 'qwebrAutoloadRPackages')).toBe('false')
    expect(setting(doc['meta-cell-options'], 'qwebrAutoloadRPackages')).toBe('true')
  })

  it('still installs the requested packages', () => {
    expect(packageList(doc['meta-autoload'])).toEqual(['ggplot2'])
    expect(packageList(doc['meta-cell-options'])).toEqual([''])
  })
})

describe('webr.cell-options', () => {
  it('reaches a cell that does not set the option itself', () => {
    expect(cellOptions(doc['meta-cell-options'])[0]['read-only']).toBe('true')
    expect(cellOptions(doc['meta-repos'])[0]['read-only']).toBe('false')
  })

  it('beats the built-in autorun default for interactive cells', () => {
    // Without a document-level value the filter forces autorun to "false"
    // for interactive cells, so this cannot pass by accident.
    expect(cellOptions(doc['meta-cell-options'])[0].autorun).toBe('true')
    expect(cellOptions(doc['meta-repos'])[0].autorun).toBe('false')
  })

  it('applies to every cell in the document', () => {
    const [first, second] = cellOptions(doc['meta-cell-options'])
    expect(second['read-only']).toBe('true')
    expect(first['out-width']).toBe('350px')
    expect(cellOptions(doc['meta-repos'])[0]['out-width']).toBe('700px')
  })

  it('yields to a cell that sets the option locally', () => {
    expect(cellOptions(doc['meta-cell-options'])[1]['out-width']).toBe('900px')
  })

  // Recorded behaviour, not an endorsement: document-level values go through
  // pandoc.utils.stringify, so a numeric default lands in the cell JSON as a
  // string while the built-in default stays a number.
  it('stringifies numeric defaults', () => {
    expect(cellOptions(doc['meta-cell-options'])[0].dpi).toBe('96')
    expect(cellOptions(doc['meta-repos'])[0].dpi).toBe(72)
  })
})
