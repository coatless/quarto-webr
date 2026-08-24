import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Reading .qmd sources the way Quarto reads them.
//
// Quarto picks a document's compute engine from the languages of its fenced
// cells. No engine claims this extension's cells, so a document holding one and
// naming no `engine:` of its own falls through to jupyter and starts a python3
// kernel. Wherever Jupyter is absent that is a hard render failure, and both CI
// workflows are such a place: publish-demo.yml installs R for the knitr engine
// and never touches Python, test.yml installs neither.
//
// This is not how Quarto has always behaved. Under quarto 1.9.12 - the version
// the last green documentation build used - the language scan was
//   /^[\t >]*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}/gm
// whose class group had no hyphen and whose trailing group demanded a space or
// a comma, so ```{webr-r} matched nothing at all and these documents quietly
// took the markdown engine. quarto-cli 1.9.19 (2026-02-03) widened it to the
// regex below, which reports the language as `webr` with `-r` spilling into the
// trailing group. Nothing claims `webr`, so nine documents that had rendered
// for years began demanding a Python kernel.

// Quarto's own scan, kept byte-identical to kChunkRegex in
// src/core/pandoc/pandoc-partition.ts. Anything looser here would bless
// documents Quarto still routes to jupyter: it accepts a fence indented or
// blockquoted (`[\t >]*`) and attributes trailing the language (`[^}]*`), so
// ```{webr-r, autorun=TRUE} and an indented cell inside a list item both count.
export const CHUNK = /^[\t >]*`{3,}\s*\{([a-zA-Z][a-zA-Z0-9_.]*)([^}]*)?\}\s*$/gm

// Both spellings the filter accepts - `{webr}` and `{webr-r}`, see the CodeBlock
// handler in _extensions/webr/webr.lua - reduce to this one language, because
// the class group above cannot hold a hyphen.
export const WEBR_LANGUAGE = 'webr'

// Requires whitespace after the colon: `engine:knitr` reads as pinned but is a
// YAML error, and blessing it would let a hard render failure through.
const ENGINE_KEY = /^engine:[ \t]+(.+?)[ \t]*$/m
const INCLUDE = /\{\{<\s*include\s+([^\s>]+?)\s*>\}\}/g

// Generated output and vendored trees, never sources.
const IGNORED_DIRS = new Set(['.git', '.quarto', '_book', '_freeze', '_site', 'node_modules'])

/** Every .qmd under a directory, skipping generated output. */
export function qmdFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Symlinks are stepped over: every example and test directory links
    // _extensions back to the repository root, which the caller scans directly.
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.endsWith('_files')) qmdFiles(full, found)
    } else if (entry.name.endsWith('.qmd')) {
      found.push(full)
    }
  }
  return found
}

export const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '')

/** The opening YAML block of a document, or '' when it has none. */
export const frontMatter = (source) =>
  source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?(?:\n|$)/)?.[1] ?? ''

/** The engine a document names, unquoted, or null when it names none. */
export function pinnedEngine(source) {
  const value = frontMatter(source).match(ENGINE_KEY)?.[1]
  return value ? value.replace(/^(['"])(.*)\1$/, '$2') : null
}

const matches = (regexp, source) => [...source.matchAll(regexp)]

/**
 * Whether a document ends up holding a webR cell, following `{{< include >}}`
 * as Quarto does. The engine is decided on the assembled document, so pinning
 * one on an included partial does nothing - only the parent counts.
 */
export function holdsWebrCell(file, seen = new Set()) {
  if (seen.has(file)) return false
  seen.add(file)
  const source = read(file)
  if (matches(CHUNK, source).some(([, language]) => language.toLowerCase() === WEBR_LANGUAGE)) {
    return true
  }
  return matches(INCLUDE, source).some(([, target]) =>
    holdsWebrCell(path.resolve(path.dirname(file), target), seen),
  )
}

// Quarto never renders a file whose name begins with an underscore on its own,
// so those are partials: their cells are the including document's problem.
export const isPartial = (file) => path.basename(file).startsWith('_')
