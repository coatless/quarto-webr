import { describe, it, expect } from 'vitest'
import { loadBrowserScript } from '../../_harness/load-globals.js'

const context = loadBrowserScript('qwebr-monaco-editor-element.js')

describe('isValidCodeLineNumbers', () => {
  const accepted = ['1', '12', '1,3', '1-5', '1,3-5,7', '2-4,9']
  const rejected = ['', 'a', '1-', '-1', '1,', '1,,2', '1 - 5', '1;2']

  it.each(accepted)('accepts %s', (input) => {
    expect(context.isValidCodeLineNumbers(input)).toBe(true)
  })

  it.each(rejected)('rejects %s', (input) => {
    expect(context.isValidCodeLineNumbers(input)).toBe(false)
  })
})
