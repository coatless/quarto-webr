import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const FIXTURE_DIR = path.resolve('tests/_fixtures')

/** Render a fixture and return its HTML. */
export function renderFixture(name) {
  execFileSync('quarto', ['render', `${name}.qmd`, '--to', 'html'], {
    cwd: FIXTURE_DIR,
    stdio: 'pipe',
  })
  return readFileSync(path.join(FIXTURE_DIR, `${name}.html`), 'utf8')
}

/**
 * Replace concrete webR versions with a placeholder.
 * The release bot rewrites this string; asserting on it directly would fail
 * every automated version-bump PR.
 */
export function normalizeVersion(html) {
  return html.replace(/v\d+\.\d+\.\d+/g, 'vX.Y.Z')
}
