import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { holdsWebrCell, isPartial, pinnedEngine, qmdFiles, read } from '../_harness/qmd.js'

// A document holding a webR cell and naming no engine of its own falls through
// to jupyter and asks CI for a python3 kernel that is not there. See the header
// of ../_harness/qmd.js for how Quarto came to behave that way. Pinning
// `engine:` is what README.md has told users to do all along; this holds the
// repository to its own advice, so the next widening upstream cannot reach the
// build. It is a source scan - no quarto, no R - so it runs on every push.
const SCANNED_DIRS = ['_extensions/webr', 'docs', 'examples', 'tests']

// The engines whose toolchain a workflow actually provides. Asserting
// membership rather than `!== 'jupyter'` keeps the test aimed at the real
// failure - an engine CI cannot run - instead of at one known-bad name.
const ALLOWED_ENGINES = new Set(['knitr', 'markdown'])

const FIXTURE_DIR = path.join('tests', '_fixtures') + path.sep

const webrDocuments = SCANNED_DIRS.flatMap((dir) =>
  qmdFiles(dir)
    .filter((file) => !isPartial(file) && holdsWebrCell(file))
    .map((file) => ({ dir, file, engine: pinnedEngine(read(file)) })),
)

describe('compute engine selection', () => {
  // A guard on the walker rather than an assertion about the repository. The
  // count runs to the dozens, so any threshold on the total would still pass
  // with a whole tree missing - and `examples` alone held five of the documents
  // that broke the build. Per-root coverage is what needs protecting.
  it.each(SCANNED_DIRS)('finds webR documents under %s', (dir) => {
    expect(webrDocuments.filter((doc) => doc.dir === dir)).not.toStrictEqual([])
  })

  it('pins an engine in every document that carries a webR cell', () => {
    const unpinned = webrDocuments.filter(({ engine }) => engine === null).map(({ file }) => file)
    expect(unpinned).toStrictEqual([])
  })

  it('pins only an engine the workflows can run', () => {
    const unrunnable = webrDocuments
      .filter(({ engine }) => engine !== null && !ALLOWED_ENGINES.has(engine))
      .map(({ file, engine }) => `${file}: ${engine}`)
    expect(unrunnable).toStrictEqual([])
  })

  // The render fixtures are the one set with a tighter constraint. They are
  // rendered by the `fast` job in .github/workflows/test.yml, which installs
  // quarto and node and nothing else - no R, so no knitr.
  it('keeps the render fixtures on the markdown engine', () => {
    const fixtures = webrDocuments
      .filter(({ file }) => file.startsWith(FIXTURE_DIR))
      .map(({ file, engine }) => `${file}: ${engine}`)
    expect(fixtures.length).toBeGreaterThan(0)
    expect(fixtures.filter((entry) => !entry.endsWith(': markdown'))).toStrictEqual([])
  })
})
