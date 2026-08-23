import { describe, it, expect, beforeAll } from 'vitest'
import { load } from 'cheerio'
import { renderFixture, normalizeVersion } from '../_harness/render.js'

describe('basic cell', () => {
  let html
  let $
  beforeAll(() => {
    html = renderFixture('basic-cell')
    $ = load(html)
  })

  it('emits exactly one insertion point', () => {
    expect($('[id^="qwebr-insertion-location-"]')).toHaveLength(1)
  })

  it('emits a noscript fallback', () => {
    expect($('noscript').length).toBeGreaterThan(0)
  })

  it('points at the versioned webR base URL', () => {
    expect(normalizeVersion(html)).toContain('https://webr.r-wasm.org/vX.Y.Z/')
  })
})

describe('multiple cells', () => {
  let $
  beforeAll(() => {
    $ = load(renderFixture('multiple-cells'))
  })

  it('emits one insertion point per cell', () => {
    expect($('[id^="qwebr-insertion-location-"]')).toHaveLength(3)
  })

  it('numbers the insertion points consecutively', () => {
    const ids = $('[id^="qwebr-insertion-location-"]')
      .map((_, el) => Number($(el).attr('id').replace('qwebr-insertion-location-', '')))
      .get()
    expect(ids).toStrictEqual([...ids].sort((a, b) => a - b))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('cell options', () => {
  let html
  beforeAll(() => {
    html = renderFixture('cell-options')
  })

  it('carries the declared context into the emitted config', () => {
    expect(html).toContain('setup')
  })

  it('does not leak option comment lines into the rendered code', () => {
    expect(html).not.toContain('#| context: setup')
  })
})

describe('document metadata', () => {
  let html
  beforeAll(() => {
    html = renderFixture('doc-metadata')
  })

  it('carries channel-type into the emitted config', () => {
    expect(html).toContain('ChannelType.PostMessage')
  })

  it('carries home-dir into the emitted config', () => {
    expect(html).toContain('/home/rstudio')
  })

  it('quotes the package list', () => {
    expect(html).toContain("'ggplot2'")
  })
})
