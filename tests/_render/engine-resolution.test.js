import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { pinnedEngine, read } from '../_harness/qmd.js'

// The companion to tests/_unit/qmd-engine.test.js. That one is a source scan
// asserting every webR document pins an engine; this one asks the installed
// Quarto what it actually does, because pinning is only worth anything while
// Quarto keeps behaving the way the pins assume.
//
// It exists because the 1.9.19 language-scan change went unnoticed for nine
// months: nothing ever resolved an engine against a moving Quarto.
// publish-demo.yml now pins an exact version, which leaves
// .github/workflows/test.yml unpinned as the canary, and leaves this the test
// that turns red there. Roughly half a second per document.

/** The engine the installed Quarto resolves for a document. */
function resolvedEngine(file) {
  const result = spawnSync('quarto', ['inspect', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`quarto inspect ${file} failed:\n${result.stderr}`)
  }
  return JSON.parse(result.stdout).engines
}

// One document per shape that has mattered.
const PINNED = [
  // Shipped by `quarto add`, so a regression here reaches every user.
  '_extensions/webr/template.qmd',
  // No executable code at all: its only webR cell is an illustration nested
  // inside a longer ````markdown fence. Quarto counts it anyway, which is how
  // this page took down the documentation build.
  'docs/qwebr-first-steps.qmd',
  // The ordinary shape - a top-level cell in a standalone document.
  'examples/html-document/index.qmd',
  // The markdown engine, which the no-R `fast` job depends on.
  'tests/_fixtures/basic-cell.qmd',
]

describe('quarto honours the pinned engine', () => {
  it.each(PINNED)('%s resolves to the engine it pins', (file) => {
    const pinned = pinnedEngine(read(file))
    // Guards the list itself: a document that stopped pinning an engine would
    // otherwise compare null against null and pass.
    expect(pinned).not.toBeNull()
    expect(resolvedEngine(file)).toStrictEqual([pinned])
  })
})

describe('quarto still needs the pins', () => {
  // Every other document in the repository pins an engine, which means Quarto
  // always agrees with it and none of them can report a change upstream. This
  // fixture is the exception that keeps watch: it names no engine, so what
  // Quarto resolves it to is upstream's answer rather than ours.
  //
  // A failure here is news, not a bug. Quarto's fallthrough for an unclaimed
  // language has moved - it went the other way in 1.9.19, when `{webr-r}`
  // stopped matching nothing and started matching the language `webr`. Read the
  // release notes, update this expectation, and check whether the pinning rule
  // in tests/_unit/qmd-engine.test.js still says the right thing.
  it('sends an unpinned webR cell to the jupyter engine', () => {
    expect(resolvedEngine('tests/_fixtures/_unpinned-webr-cell.qmd')).toStrictEqual(['jupyter'])
  })
})
