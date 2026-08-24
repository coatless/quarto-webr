import { describe, it, expect, beforeAll } from 'vitest'
import { renderFixture } from '../_harness/render.js'

/**
 * Pull the per-cell config the filter serialises into the page.
 *
 * The filter emits `globalThis.qwebrCellDetails = [...]` as a single JSON
 * array. Parsing it (rather than substring-matching the page) lets the
 * assertions below pin the JSON *type* of each value, not just its text.
 */
function cellDetails(html, index = 0) {
  const match = html.match(/globalThis\.qwebrCellDetails\s*=\s*(\[[\s\S]*?\]);/)
  expect(match, 'page should carry a qwebrCellDetails array').not.toBeNull()
  return JSON.parse(match[1])[index]
}

function cellOptions(html, index = 0) {
  return cellDetails(html, index).options
}

/**
 * The built-in defaults from `buildDefaultCellOptions` in
 * `_extensions/webr/qwebr-utils.lua`, paired with the non-default value
 * `cell-options-full.qmd` sets for the same key.
 *
 * Every pair is differential: the default value is absent from the rendered
 * `cell-options-full.html` and the explicit value is absent from the rendered
 * `cell-options-defaults.html`. Changing a value here without re-checking that
 * property would reintroduce the vacuous assertions this suite exists to avoid.
 */
const OPTIONS = [
  // key,                       default,    explicit non-default
  ['warning', 'true', 'false'],
  ['message', 'true', 'false'],
  ['results', 'markup', 'asis'],
  ['output', 'true', 'false'],
  ['comment', '', '##'],
  ['classes', '', 'my-custom-class'],
  ['dpi', 72, '300'],
  ['fig-cap', '', 'A custom figure caption'],
  ['fig-width', 7, '9'],
  ['fig-height', 5, '3'],
  ['out-width', '700px', '512px'],
  ['out-height', '', '480px'],
  ['editor-font-scale', '1', '1.5'],
  ['editor-max-height', '', '400px'],
  ['editor-quick-suggestions', 'false', 'true'],
  ['editor-word-wrap', 'true', 'false'],
]

// `label` is handled separately: its raw default is "", but webr.lua rewrites an
// empty label to "unnamed-chunk-<counter>" before the config is serialised, so
// the observable default is the generated name rather than the table entry.
const LABEL_DEFAULT = 'unnamed-chunk-1'
const LABEL_EXPLICIT = 'my-custom-label'

describe('cell options: built-in defaults', () => {
  let options
  beforeAll(() => {
    options = cellOptions(renderFixture('cell-options-defaults'))
  })

  it.each(OPTIONS)('defaults %s to %o', (key, expected) => {
    expect(options[key]).toStrictEqual(expected)
  })

  it('derives an unnamed-chunk label when none is given', () => {
    expect(options.label).toStrictEqual(LABEL_DEFAULT)
  })

  it('pins the complete default option table', () => {
    // Guards every key at once, so a default added to or dropped from
    // buildDefaultCellOptions fails here even if no individual case covers it.
    expect(options).toStrictEqual({
      context: 'interactive',
      autorun: 'false', // derived: empty autorun + interactive context
      'read-only': 'false',
      label: LABEL_DEFAULT, // derived: empty label + cell counter
      warning: 'true',
      message: 'true',
      results: 'markup',
      output: 'true',
      comment: '',
      classes: '',
      dpi: 72,
      'fig-cap': '',
      'fig-width': 7,
      'fig-height': 5,
      'out-width': '700px',
      'out-height': '',
      'editor-font-scale': '1',
      'editor-max-height': '',
      'editor-quick-suggestions': 'false',
      'editor-word-wrap': 'true',
    })
  })
})

describe('cell options: explicit values reach the emitted config', () => {
  let html
  let options
  beforeAll(() => {
    html = renderFixture('cell-options-full')
    options = cellOptions(html)
  })

  it.each(OPTIONS)('carries %s: %o into the config', (key, _default, explicit) => {
    expect(options[key]).toStrictEqual(explicit)
  })

  it('carries an explicit label into the config', () => {
    expect(options.label).toStrictEqual(LABEL_EXPLICIT)
  })

  it('overrides every default it was given', () => {
    // Belt-and-braces on the differential property: not one emitted value is
    // still the default, so no case above can be passing by coincidence.
    for (const [key, fallback] of OPTIONS) {
      expect(options[key], `${key} should not still be the default`).not.toStrictEqual(fallback)
    }
    expect(options.label).not.toStrictEqual(LABEL_DEFAULT)
  })

  it('strips the option comment lines out of the executable code', () => {
    expect(cellDetails(html).code).toStrictEqual('1 + 1')
  })

  it.each([...OPTIONS.map(([key]) => key), 'label'])(
    'does not leak the #| %s line into the page',
    (key) => {
      expect(html).not.toContain(`#| ${key}:`)
    },
  )
})
