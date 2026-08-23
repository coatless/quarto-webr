import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

function runLuaSuite() {
  try {
    return execFileSync('quarto', ['pandoc', 'lua', 'tests/_harness/run-lua-tests.lua'], {
      encoding: 'utf8',
    })
  } catch (error) {
    // Non-zero exit is expected when a Lua assertion fails; the TAP is on stdout.
    return `${error.stdout ?? ''}${error.stderr ?? ''}`
  }
}

function parseTap(raw) {
  const results = []
  let current = null
  for (const line of raw.split('\n')) {
    const match = line.match(/^(ok|not ok) (\d+) - (.*)$/)
    if (match) {
      current = { ok: match[1] === 'ok', name: match[3], diagnostics: [] }
      results.push(current)
    } else if (current && line.startsWith('  ')) {
      current.diagnostics.push(line.trim())
    }
  }
  return results
}

const results = parseTap(runLuaSuite())

describe('lua unit tests', () => {
  it('the Lua suite produced assertions', () => {
    expect(results.length).toBeGreaterThan(0)
  })

  for (const result of results) {
    it(result.name, () => {
      expect(result.ok, result.diagnostics.join('\n')).toBe(true)
    })
  }
})
