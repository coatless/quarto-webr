import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

function runLuaSuite() {
  try {
    const stdout = execFileSync('quarto', ['pandoc', 'lua', 'tests/_harness/run-lua-tests.lua'], {
      encoding: 'utf8',
    })
    return { raw: stdout, status: 0 }
  } catch (error) {
    // Non-zero exit is expected when a Lua assertion fails; the TAP is on
    // stdout. It is *also* what a mid-run crash looks like, which is why the
    // plan line below is checked rather than trusted.
    return {
      raw: `${error.stdout ?? ''}${error.stderr ?? ''}`,
      status: error.status ?? -1,
    }
  }
}

function parseTap(raw) {
  const results = []
  let plan = null
  let current = null
  for (const line of raw.split('\n')) {
    const match = line.match(/^(ok|not ok) (\d+) - (.*)$/)
    const planMatch = line.match(/^1\.\.(\d+)$/)
    if (match) {
      current = { ok: match[1] === 'ok', name: match[3], diagnostics: [] }
      results.push(current)
    } else if (planMatch) {
      plan = Number(planMatch[1])
      current = null
    } else if (current && line.startsWith('  ')) {
      current.diagnostics.push(line.trim())
    }
  }
  return { results, plan }
}

const { raw, status } = runLuaSuite()
const { results, plan } = parseTap(raw)

// A crash part-way through the Lua suite still prints the `ok` lines emitted
// before it died. Without this check the bridge reports those as a green run
// and silently drops every assertion that never got to execute. `tap.finish()`
// prints the `1..N` plan only on clean completion, so the plan line is the
// signal that the whole suite actually ran.
const tail = raw.split('\n').slice(-25).join('\n')

describe('lua suite completion', () => {
  it('ran to completion and emitted a TAP plan', () => {
    expect(plan, `no TAP plan line; the Lua runner exited ${status}:\n${tail}`).not.toBeNull()
  })

  it('emitted every assertion the plan promised', () => {
    expect(results.length, `TAP plan promised ${plan} assertions:\n${tail}`).toBe(plan)
  })

  it('produced at least one assertion', () => {
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('lua unit tests', () => {
  for (const result of results) {
    it(result.name, () => {
      expect(result.ok, result.diagnostics.join('\n')).toBe(true)
    })
  }
})
