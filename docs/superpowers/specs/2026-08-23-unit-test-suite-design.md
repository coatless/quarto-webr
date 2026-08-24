# Design: Automated Test Suite for quarto-webr

- **Date:** 2026-08-23
- **Status:** Approved (design); implementation plan pending
- **Scope:** New test subsystem + a small refactor of `_extensions/webr/webr.lua`

## 1. Problem

The repository has **no automated tests and no assertions of any kind**.

`tests/` is a Quarto *website* of ~30 hand-written pages that a human opens in a
browser and eyeballs. CI (`publish-demo.yml`) renders it and deploys it to the
demo site. A green build therefore proves exactly one thing: the Lua filter did
not crash. It does not check that cell options parsed correctly, that the
emitted HTML is well formed, or that webR actually runs R code.

This matters more now that `webr-release-update.yml` opens automated PRs that
bump the embedded webR version (0.5.7 → 0.6.0 most recently). Those PRs change
the runtime the extension depends on, and nothing in CI can tell the difference
between "still works" and "renders fine, broken in the browser".

## 2. Goals and non-goals

### Goals

1. Catch regressions in the Lua filter's option parsing and HTML generation with
   fast, precise, offline tests.
2. Catch runtime breakage after a webR version bump, in a real browser.
3. Run on every push (fast layers) without making the contributor loop slow.
4. Add no new runtime dependency for the Lua layer.

### Non-goals

- **Not** replacing `tests/`. The demo site stays exactly as it is; it has value
  as human-facing documentation of features.
- **Not** unit-testing the DOM-building JavaScript. Layers 2 and 4 cover that
  behaviour far better than jsdom would, and at lower maintenance cost.
- **Not** snapshotting whole rendered HTML files. Those break on every Quarto
  release and every webR version bump, training everyone to re-bless blindly.
- **Not** fixing the latent bugs found during design (§9). Tests first record
  current behaviour; behaviour changes are a separate, deliberate decision.

## 3. Verified constraints

Each of these was checked empirically during design, not assumed.

| Fact | Consequence |
|---|---|
| `quarto pandoc lua script.lua` runs Lua 5.4 with the real `pandoc` global | Lua tests need no Lua install, no busted, no pandoc stubbing. CI already has Quarto. |
| A Quarto filter can `require` a sibling module from its extension directory | The `qwebr-utils.lua` extraction ships correctly to users. |
| Quarto does not render `_`-prefixed directories | The suite lives under `tests/` without `_quarto.yml` changes and never leaks into the deployed site. |
| `webr.lua` loads under a shallow `quarto` stub, failing only at `quarto.doc` | The filter is close to loadable in isolation; one construct blocks it (§5.1). |
| Every helper in `webr.lua` is `local`; the file exports only three Pandoc handler tables | Nothing is reachable from a test harness today. Extraction is required. |

## 4. Architecture

Four layers, ordered by speed. Each layer tests what the layer below cannot
reach, and nothing more.

| Layer | Runner | Target | Runtime | CI trigger |
|---|---|---|---|---|
| 1. Lua unit | `quarto pandoc lua` | Pure filter logic | ~1s | every push |
| 2. Render | vitest + `quarto render` | Emitted HTML | ~30s | every push |
| 3. JS unit | vitest + jsdom | Pure browser helpers | ~2s | every push |
| 4. Browser | Playwright | webR actually executes R | ~3min | nightly + release-bot PRs |

`npm test` drives all four. Layer 1 emits TAP, which the vitest adapter parses so
a failing Lua assertion reports as its own test with its own message, rather
than as one opaque non-zero exit.

## 5. Required source changes

### 5.1 The blocker: impure defaults

`webr.lua:94` builds the cell-option defaults table by calling into Quarto at
construction time:

```lua
["editor-font-scale"] = quarto.doc.is_format("revealjs") and "0.5" or "1",
```

This is why loading the filter in isolation fails. The table is module-level
state whose value depends on the output format, so it cannot simply move to a
pure module.

**Resolution:** convert it from a table into a function of the format flag.

```lua
-- qwebr-utils.lua
function M.buildDefaultCellOptions(isRevealJS)
  return { ..., ["editor-font-scale"] = isRevealJS and "0.5" or "1", ... }
end
```

The filter calls `M.buildDefaultCellOptions(quarto.doc.is_format("revealjs"))`.
Quarto coupling stays in the filter; the table shape becomes testable.

### 5.2 Functions moving to `_extensions/webr/qwebr-utils.lua`

| Function | Change |
|---|---|
| `isVariableEmpty` / `isVariablePopulated` | move as-is |
| `shallowcopy` / `table.clone` | move as-is; stop monkey-patching global `table` |
| `mergeCellOptions` | takes defaults as a parameter instead of closing over the module table |
| `convertMetaChannelTypeToWebROption` | move as-is |
| `removeEmptyLinesUntilContent` | move as-is |
| `extractCodeBlockOptions` | takes defaults as a parameter |
| `substituteInFile` | move as-is |
| `specifyBaseUrl` | becomes pure `buildBaseUrl(base, version)`; currently mutates module-local `baseUrl` |
| *(new)* `quoteAndJoin` | extracted from the duplicated repos/packages loops in `setWebRInitializationOptions` |

Everything else stays in `webr.lua`. In particular `setWebRInitializationOptions`
is deliberately **not** extracted: it mutates a dozen module locals and reads
Pandoc metadata. Layer 2 covers it end-to-end, which is the right altitude for it.

Expected effect: `webr.lua` drops roughly 130 lines.

## 6. Layout

```
_extensions/webr/
  qwebr-utils.lua          NEW  pure helpers, returns M
  webr.lua                 MOD  local utils = require("qwebr-utils")

tests/                          unchanged; still the published demo site
  _harness/
    tap.lua                     ~40 line assert + TAP emitter
    run-lua-tests.lua           discovers and runs *.test.lua
    serve.js                    static server with COOP/COEP headers
    load-globals.js             evals a browser script into a jsdom sandbox
  _unit/
    lua/*.test.lua
    js/*.test.js
  _render/*.test.js
  _e2e/*.spec.js
  _fixtures/*.qmd               minimal, single-purpose inputs

package.json               NEW  vitest, playwright, jsdom, cheerio
```

`_`-prefixed directories are invisible to Quarto, so none of this is rendered or
deployed, and `tests/_quarto.yml` needs no change.

## 7. Layer specifications

### Layer 1 — Lua unit tests

No dependencies. `quarto pandoc lua tests/_harness/run-lua-tests.lua`.

Cases worth pinning down, chosen because each is logic a future change could
plausibly break:

**`extractCodeBlockOptions`**
- `#| key: value` extracted; the line is removed from the returned code
- `#|key: value` (no space) still parses
- values containing colons survive intact (`base-url: https://…`)
- non-option comments (`# regular comment`) are kept as code
- CRLF line endings parse the same as LF
- leading blank lines are stripped, interior blank lines are not

**`mergeCellOptions`**
- unspecified keys fall back to defaults
- local options override defaults
- unknown keys pass through rather than being dropped
- quote stripping behaviour is recorded exactly as it is today (§9.1)

**`convertMetaChannelTypeToWebROption`**
- all four names and all four integers map correctly
- an unknown value falls back to `ChannelType.Automatic`
- the string `"3"` vs the integer `3` discrepancy is recorded (§9.2)

**`buildBaseUrl`** — `"latest"` → `…/latest/`; a version → `…/v0.6.0/`.
Directly guards the value the release bot rewrites.

**`removeEmptyLinesUntilContent`** — leading blanks, whitespace-only lines,
an all-blank block, and a block with no leading blanks.

**`substituteInFile`** — substitution, whitespace tolerance inside `{{ }}`,
and the behaviour when a key is absent from the table.

**`quoteAndJoin`** — empty list, one item, several items.

### Layer 2 — Render tests

For each fixture: `quarto render`, then assert against the emitted HTML with
cheerio. Fixtures are minimal and single-purpose — *not* the 30 demo pages,
which are too slow and test too many things at once to localise a failure.

Assertions cover: one `qwebr-insertion-location-N` div per cell with correct
counter sequencing; the `<noscript>` fallback; per-cell option JSON matching the
input `#|` options; `context: setup` / `interactive` / `output` producing the
right element shapes; document-level `webr:` metadata reaching the emitted
config; and the base URL reflecting the configured version.

**Version normalisation is mandatory.** Any assertion touching a webR version
must normalise it (`/v\d+\.\d+\.\d+/` → `vX.Y.Z`) or match structurally.
Otherwise every release-bot PR fails CI on a version string, and the bot's
whole purpose is defeated.

### Layer 3 — JS unit tests

The browser scripts are globals, not modules — no `export`, assigned as
`globalThis.qwebrX = function …`. `load-globals.js` reads a file and evals it in
a jsdom sandbox, then reaches the resulting globals. **No source changes to the
JS.**

Scope is limited to genuinely pure helpers: `isValidCodeLineNumbers` (the
`1,3-5` line-range grammar), `formatDateTime`, and `safeFileName`. That is a
small surface, and deliberately so — everything else is DOM construction, which
layers 2 and 4 test more honestly.

### Layer 4 — Browser smoke tests

Render two or three fixtures, serve them through `serve.js` with
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`, and drive headless Chromium.

Serving with the isolation headers means the default `ChannelType.Automatic`
resolves to SharedArrayBuffer — the path real users get. If that proves flaky in
CI, the fallback is pinning fixtures to `channel-type: post-message`, which
needs no headers, at the cost of no longer testing the default path.

Assertions: webR reaches ready state; clicking Run Code on a cell computing a
known value renders that value; a plotting cell produces a canvas; an erroring
cell surfaces its message. Generous timeouts — webR boot is tens of seconds.

## 8. CI

A new `test.yml` workflow:

- **`fast` job**, on every push and PR: layers 1–3. Target under two minutes.
- **`browser` job**: layer 4, on a nightly schedule and on PRs labelled
  `webr-update` — precisely the release bot's PRs, which is where runtime
  breakage would otherwise reach main unnoticed.

`publish-demo.yml` is untouched.

## 9. Latent bugs found during design

All three are **recorded by tests, not fixed** by this work.

### 9.1 Quote stripping is global, not edge-trimming

`mergeCellOptions` runs `value:gsub("[\"']", "")`, removing every quote anywhere
in the value rather than trimming a surrounding pair:

| Input | Result |
|---|---|
| `"hello"` | `hello` (intended) |
| `It's here` | `Its here` (apostrophe eaten) |
| `"It's a test"` | `Its a test` |

Any `fig-cap`, `label`, or `comment` containing an apostrophe is silently
mangled. A fix would trim only a matched surrounding pair.

### 9.2 Quoted integer channel types silently fall back

The lookup table keys integers as integers. YAML `channel-type: 3` yields a
number and resolves to `PostMessage`; `channel-type: '3'` yields the string
`"3"`, misses the table, and falls back to `ChannelType.Automatic` with no
warning. A fix would normalise the key, or warn on an unrecognised value.

### 9.3 CRLF line endings inject blank lines into the code

`extractCodeBlockOptions` splits with `code:gmatch("([^\r\n]*)[\r\n]?")`. The
pattern consumes at most one line terminator, so a CRLF pair also matches the
empty string sitting between the CR and the LF:

| Input | Result |
|---|---|
| `1 + 1\n2 + 2` | `["1 + 1", "2 + 2"]` |
| `1 + 1\r\n2 + 2` | `["1 + 1", "", "2 + 2"]` |

One spurious blank line per CRLF pair. `removeEmptyLinesUntilContent` masks it
at the top of a cell, so a document authored on Windows renders with the code
double-spaced from the second line onwards rather than failing outright. A fix
would match `\r?\n` as a unit, or strip CR before splitting.

## 10. Risks

| Risk | Mitigation |
|---|---|
| The refactor breaks the shipping filter | Layer 2 renders real documents; the extraction is mechanical and lands before any test is written against it. Verified that sibling `require` works under a real render. |
| Browser layer is flaky and gets ignored | Kept off the per-push path; if it flakes it fails a nightly, not a contributor's PR. Fallback channel documented. |
| Version strings make tests fail on every bot PR | Normalisation is a stated requirement of layer 2, not an afterthought. |
| `package.json` in a repo that had none | Confined to `devDependencies`; the Lua layer runs without Node so the fastest feedback loop never needs `npm install`. |
| Fixtures drift from the demo pages | Fixtures test behaviour, demo pages document features. They are allowed to diverge; that is the point. |

## 11. Success criteria

1. `npm test` runs green locally and in CI.
2. Layers 1–3 finish in under two minutes on a cold CI runner.
3. Reverting the `qwebr-utils.lua` extraction, or corrupting any single function
   in it, turns at least one layer-1 test red with a message naming the function.
4. Manually pinning a fixture to a broken webR version turns layer 4 red.
5. A release-bot PR bumping the webR version passes layers 1–3 unchanged — no
   snapshot re-blessing, no version-string churn.
