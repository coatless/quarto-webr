# Automated Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give quarto-webr an automated test suite that fails when the Lua filter, its emitted HTML, or webR's in-browser execution regresses.

**Architecture:** Four layers ordered by speed. Pure filter logic moves out of `webr.lua` into a new `qwebr-utils.lua` module so it can be called directly by a Lua harness that runs on Pandoc's embedded Lua 5.4. Rendered-HTML assertions and a Playwright smoke test cover what unit tests cannot reach. `npm test` drives everything; the Lua layer also runs standalone with no Node.

**Tech Stack:** Lua 5.4 (via `quarto pandoc lua`, no install), vitest, jsdom, cheerio, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-23-unit-test-suite-design.md`

## Global Constraints

- **Lua layer must not require Node or any Lua package.** It runs as `quarto pandoc lua tests/_harness/run-lua-tests.lua`. Verified: this gives Lua 5.4 with the real `pandoc` global.
- **`qwebr-utils.lua` must reference no `quarto` or `pandoc` global.** Purity is what makes it loadable by the harness. Format-dependent values are passed in as parameters.
- **Fixtures use `engine: markdown`.** Verified: this renders the filter with no R and no Python installed. Do not use `engine: knitr` — it drags R into CI for no benefit.
- **Fixtures require `tests/_fixtures/_extensions` → `../../_extensions` (symlink).** Verified: without it, `filters: [webr]` resolves against the fixture's own directory and the render fails with "Could not run … webr as a JSON filter".
- **Every assertion touching a webR version must normalise it.** Replace `/v\d+\.\d+\.\d+/` with `vX.Y.Z` before comparing. The release bot rewrites this string; hard-coding it makes every bot PR fail.
- **All new directories under `tests/` are `_`-prefixed.** Verified: Quarto does not render `_`-prefixed directories, so nothing leaks into the deployed demo site and `tests/_quarto.yml` needs no change.
- **Do not fix the two known bugs** (global quote stripping, quoted-integer channel types). Tests record current behaviour; changing it is a separate decision.

---

### Task 1: Lua test harness

**Files:**
- Create: `tests/_harness/tap.lua`
- Create: `tests/_harness/run-lua-tests.lua`
- Test: `tests/_unit/lua/harness.test.lua`

**Interfaces:**
- Consumes: nothing.
- Produces: `tap.eq(actual, expected, name)`, `tap.ok(value, name)`, `tap.setFile(name)`, `tap.finish() -> failureCount`. Every later Lua test file calls `require("tap")` and uses these.

- [ ] **Step 1: Write the harness**

`tests/_harness/tap.lua`:

```lua
--- Minimal TAP-emitting assertion helper.
--- No dependencies: runs under `quarto pandoc lua`.
local M = {}

local count = 0
local failures = 0
local currentFile = "?"

local function serialize(value)
  if type(value) ~= "table" then
    return tostring(value)
  end
  local keys = {}
  for key in pairs(value) do
    keys[#keys + 1] = key
  end
  table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
  local parts = {}
  for _, key in ipairs(keys) do
    parts[#parts + 1] = tostring(key) .. "=" .. serialize(value[key])
  end
  return "{" .. table.concat(parts, ", ") .. "}"
end

local function deepEqual(a, b)
  if a == b then return true end
  if type(a) ~= "table" or type(b) ~= "table" then return false end
  for key, value in pairs(a) do
    if not deepEqual(value, b[key]) then return false end
  end
  for key in pairs(b) do
    if a[key] == nil then return false end
  end
  return true
end

local function report(ok, name, expected, actual)
  count = count + 1
  if ok then
    print(string.format("ok %d - %s", count, name))
  else
    failures = failures + 1
    print(string.format("not ok %d - %s", count, name))
    print("  ---")
    print("  file: " .. currentFile)
    print("  expected: " .. serialize(expected))
    print("  actual:   " .. serialize(actual))
    print("  ...")
  end
end

function M.setFile(name) currentFile = name end

function M.eq(actual, expected, name)
  report(deepEqual(actual, expected), name, expected, actual)
end

function M.ok(value, name)
  report(value and true or false, name, true, value)
end

function M.finish()
  print("1.." .. count)
  return failures
end

return M
```

- [ ] **Step 2: Write the runner**

`tests/_harness/run-lua-tests.lua`:

```lua
--- Discovers and runs every *.test.lua under tests/_unit/lua, emitting TAP.
--- Usage: quarto pandoc lua tests/_harness/run-lua-tests.lua
local harnessDir = pandoc.path.directory(arg[0])
local testsDir = pandoc.path.directory(harnessDir)
local repoRoot = pandoc.path.directory(testsDir)

package.path = table.concat({
  harnessDir .. "/?.lua",
  repoRoot .. "/_extensions/webr/?.lua",
  package.path,
}, ";")

local tap = require("tap")

local unitDir = testsDir .. "/_unit/lua"
local entries = pandoc.system.list_directory(unitDir)
table.sort(entries)

for _, entry in ipairs(entries) do
  if entry:match("%.test%.lua$") then
    tap.setFile(entry)
    dofile(unitDir .. "/" .. entry)
  end
end

os.exit(tap.finish())
```

- [ ] **Step 3: Write the failing self-test**

`tests/_unit/lua/harness.test.lua`:

```lua
local tap = require("tap")

tap.eq(1 + 1, 2, "harness: numeric equality")
tap.eq("a", "a", "harness: string equality")
tap.eq({ x = 1, y = { z = 2 } }, { x = 1, y = { z = 2 } }, "harness: deep table equality")
tap.ok(true, "harness: ok() accepts truthy")
```

- [ ] **Step 4: Run it and confirm TAP output**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua; echo "exit=$?"
```

Expected: four `ok` lines, then `1..4`, then `exit=0`.

- [ ] **Step 5: Prove the harness can actually fail**

Temporarily append `tap.eq(1, 2, "deliberate failure")` to `harness.test.lua`, re-run, and confirm you see `not ok 5 - deliberate failure`, a diagnostic block naming the file, and a non-zero exit. Then delete that line. A harness that cannot fail is worse than no harness.

- [ ] **Step 6: Commit**

```bash
git add tests/_harness tests/_unit/lua/harness.test.lua
git commit -m "test: add TAP harness for Lua unit tests"
```

---

### Task 2: Extract the simple pure helpers

`webr.lua` is **not** modified in this task. The module is created and tested standalone; rewiring happens in Task 4. This keeps a reviewable boundary between "new code exists and is correct" and "the shipping filter now depends on it".

**Files:**
- Create: `_extensions/webr/qwebr-utils.lua`
- Test: `tests/_unit/lua/utils-basics.test.lua`

**Interfaces:**
- Consumes: `tap` from Task 1.
- Produces:
  - `M.isVariableEmpty(s) -> boolean`
  - `M.isVariablePopulated(s) -> boolean`
  - `M.shallowcopy(original) -> any`
  - `M.buildBaseUrl(base, version) -> string`
  - `M.quoteAndJoin(values, extra) -> string`
  - `M.substituteInFile(contents, substitutions) -> string`
  - `M.removeEmptyLinesUntilContent(codeLines) -> table`

- [ ] **Step 1: Write the failing test**

`tests/_unit/lua/utils-basics.test.lua`:

```lua
local tap = require("tap")
local utils = require("qwebr-utils")

-- isVariableEmpty / isVariablePopulated
tap.eq(utils.isVariableEmpty(nil), true, "isVariableEmpty: nil is empty")
tap.eq(utils.isVariableEmpty(""), true, "isVariableEmpty: empty string is empty")
tap.eq(utils.isVariableEmpty("x"), false, "isVariableEmpty: non-empty string is not empty")
tap.eq(utils.isVariablePopulated(nil), false, "isVariablePopulated: nil is not populated")
tap.eq(utils.isVariablePopulated("x"), true, "isVariablePopulated: string is populated")

-- shallowcopy
local original = { a = 1, nested = { b = 2 } }
local copy = utils.shallowcopy(original)
copy.a = 99
tap.eq(original.a, 1, "shallowcopy: top level is detached")
tap.ok(copy.nested == original.nested, "shallowcopy: nested table is shared by reference")
tap.eq(utils.shallowcopy("scalar"), "scalar", "shallowcopy: non-table returned as-is")

-- buildBaseUrl: guards exactly the string the release bot rewrites
tap.eq(utils.buildBaseUrl("https://webr.r-wasm.org/", "0.6.0"),
       "https://webr.r-wasm.org/v0.6.0/", "buildBaseUrl: pins a version")
tap.eq(utils.buildBaseUrl("https://webr.r-wasm.org/", "latest"),
       "https://webr.r-wasm.org/latest/", "buildBaseUrl: latest has no v prefix")

-- quoteAndJoin
tap.eq(utils.quoteAndJoin({}), "", "quoteAndJoin: empty list")
tap.eq(utils.quoteAndJoin({ "ggplot2" }), "'ggplot2'", "quoteAndJoin: single item")
tap.eq(utils.quoteAndJoin({ "a", "b" }), "'a', 'b'", "quoteAndJoin: several items")
tap.eq(utils.quoteAndJoin({ "a" }, "'default'"), "'a', 'default'",
       "quoteAndJoin: extra is appended already-quoted")

-- substituteInFile
tap.eq(utils.substituteInFile("x {{ NAME }} y", { NAME = "z" }), "x z y",
       "substituteInFile: replaces a key")
tap.eq(utils.substituteInFile("x {{NAME}} y", { NAME = "z" }), "x z y",
       "substituteInFile: tolerates missing inner whitespace")
tap.eq(utils.substituteInFile("x {{ MISSING }} y", { NAME = "z" }), "x {{ MISSING }} y",
       "substituteInFile: leaves unknown keys untouched")

-- removeEmptyLinesUntilContent
tap.eq(utils.removeEmptyLinesUntilContent({ "", "  ", "code", "", "more" }),
       { "code", "", "more" }, "removeEmptyLines: strips leading blanks, keeps interior")
tap.eq(utils.removeEmptyLinesUntilContent({ "code" }), { "code" },
       "removeEmptyLines: no leading blanks is a no-op")
tap.eq(utils.removeEmptyLinesUntilContent({ "", "  " }), {},
       "removeEmptyLines: all-blank becomes empty")
```

- [ ] **Step 2: Run it and verify it fails**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua
```

Expected: FAIL with `module 'qwebr-utils' not found`.

- [ ] **Step 3: Write the module**

`_extensions/webr/qwebr-utils.lua`:

```lua
--- Pure helpers for the quarto-webr filter.
---
--- This module deliberately references no `quarto` and no `pandoc` global so
--- that the test harness can load it directly. Anything format-dependent is
--- passed in as a parameter by webr.lua.
local M = {}

--- Check if variable missing or an empty string
function M.isVariableEmpty(s)
  return s == nil or s == ''
end

--- Check if variable is present
function M.isVariablePopulated(s)
  return not M.isVariableEmpty(s)
end

--- Copy the top level value and its direct children
function M.shallowcopy(original)
  if type(original) == 'table' then
    local copy = {}
    for key, value in pairs(original) do
      copy[key] = value
    end
    return copy
  else
    return original
  end
end

--- Build the versioned webR base URL.
function M.buildBaseUrl(base, version)
  if version == "latest" then
    return base .. "latest/"
  end
  return base .. "v" .. version .. "/"
end

--- Wrap each value in single quotes and join with ", ".
--- `extra` is appended verbatim (it is expected to be pre-quoted).
function M.quoteAndJoin(values, extra)
  local out = {}
  for _, value in ipairs(values) do
    out[#out + 1] = "'" .. value .. "'"
  end
  if extra then
    out[#out + 1] = extra
  end
  return table.concat(out, ", ")
end

--- Replace keywords given by {{ WORD }}
function M.substituteInFile(contents, substitutions)
  return (contents:gsub("{{%s*(.-)%s*}}", substitutions))
end

--- Remove lines with only whitespace until the first non-whitespace character.
function M.removeEmptyLinesUntilContent(codeLines)
  while codeLines[1] and string.match(codeLines[1], "^%s*$") do
    table.remove(codeLines, 1)
  end
  return codeLines
end

return M
```

Note the parentheses in `substituteInFile`: `gsub` returns two values, and the original assigned it to a single variable before returning. The parentheses reproduce that, returning only the string.

- [ ] **Step 4: Run it and verify it passes**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua; echo "exit=$?"
```

Expected: all `ok`, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add _extensions/webr/qwebr-utils.lua tests/_unit/lua/utils-basics.test.lua
git commit -m "test: extract and cover pure filter helpers"
```

---

### Task 3: Extract the cell-option machinery

**Files:**
- Modify: `_extensions/webr/qwebr-utils.lua`
- Test: `tests/_unit/lua/utils-cell-options.test.lua`

**Interfaces:**
- Consumes: `M.shallowcopy`, `M.removeEmptyLinesUntilContent` from Task 2.
- Produces:
  - `M.buildDefaultCellOptions(isRevealJS) -> table` — returns a **fresh** table each call. `webr.lua` mutates its copy when document metadata sets `webr.cell-options`, so this must not return a shared singleton.
  - `M.convertMetaChannelTypeToWebROption(input) -> string`
  - `M.mergeCellOptions(defaults, localOptions) -> table`
  - `M.extractCodeBlockOptions(block, defaults) -> table, table` — returns code lines then options, in that order.

- [ ] **Step 1: Write the failing test**

`tests/_unit/lua/utils-cell-options.test.lua`:

```lua
local tap = require("tap")
local utils = require("qwebr-utils")

-- buildDefaultCellOptions
local defaults = utils.buildDefaultCellOptions(false)
tap.eq(defaults["context"], "interactive", "defaults: context")
tap.eq(defaults["editor-font-scale"], "1", "defaults: font scale for html")
tap.eq(utils.buildDefaultCellOptions(true)["editor-font-scale"], "0.5",
       "defaults: font scale for revealjs")
local first = utils.buildDefaultCellOptions(false)
first["context"] = "mutated"
tap.eq(utils.buildDefaultCellOptions(false)["context"], "interactive",
       "defaults: each call returns a fresh table")

-- convertMetaChannelTypeToWebROption
tap.eq(utils.convertMetaChannelTypeToWebROption("automatic"), "ChannelType.Automatic", "channel: automatic")
tap.eq(utils.convertMetaChannelTypeToWebROption("shared-array-buffer"), "ChannelType.SharedArrayBuffer", "channel: sab")
tap.eq(utils.convertMetaChannelTypeToWebROption("service-worker"), "ChannelType.ServiceWorker", "channel: sw")
tap.eq(utils.convertMetaChannelTypeToWebROption("post-message"), "ChannelType.PostMessage", "channel: postmessage")
tap.eq(utils.convertMetaChannelTypeToWebROption(0), "ChannelType.Automatic", "channel: integer 0")
tap.eq(utils.convertMetaChannelTypeToWebROption(3), "ChannelType.PostMessage", "channel: integer 3")
tap.eq(utils.convertMetaChannelTypeToWebROption("nonsense"), "ChannelType.Automatic", "channel: unknown falls back")
-- KNOWN BUG (spec 9.2): a quoted integer in YAML arrives as a string and misses
-- the table. Recorded, not fixed.
tap.eq(utils.convertMetaChannelTypeToWebROption("3"), "ChannelType.Automatic",
       "channel: KNOWN BUG string '3' silently falls back to Automatic")

-- mergeCellOptions
local merged = utils.mergeCellOptions({ context = "interactive", dpi = 72 }, { context = "setup" })
tap.eq(merged["context"], "setup", "merge: local overrides default")
tap.eq(merged["dpi"], 72, "merge: untouched default survives")
tap.eq(utils.mergeCellOptions({ a = 1 }, { unknown = "x" })["unknown"], "x",
       "merge: unknown keys pass through")
-- KNOWN BUG (spec 9.1): quote stripping is global, not edge-trimming.
tap.eq(utils.mergeCellOptions({}, { label = '"quoted"' })["label"], "quoted",
       "merge: surrounding quotes are stripped")
tap.eq(utils.mergeCellOptions({}, { label = "It's here" })["label"], "Its here",
       "merge: KNOWN BUG interior apostrophe is eaten")

-- extractCodeBlockOptions
local code, options = utils.extractCodeBlockOptions(
  { text = "#| context: setup\n#| autorun: false\n1 + 1" }, defaults)
tap.eq(options["context"], "setup", "extract: parses an option")
tap.eq(options["autorun"], "false", "extract: parses a second option")
tap.eq(code[1], "1 + 1", "extract: option lines removed from code")

tap.eq(select(2, utils.extractCodeBlockOptions({ text = "#|context: setup\n1" }, defaults))["context"],
       "setup", "extract: no space after #| still parses")

tap.eq(select(2, utils.extractCodeBlockOptions(
         { text = "#| base-url: https://webr.r-wasm.org/v0.6.0/\n1" }, defaults))["base-url"],
       "https://webr.r-wasm.org/v0.6.0/", "extract: colons inside values survive")

local keptCode = utils.extractCodeBlockOptions({ text = "# a normal comment\n1 + 1" }, defaults)
tap.eq(keptCode[1], "# a normal comment", "extract: ordinary comments stay in the code")

local crlf = utils.extractCodeBlockOptions({ text = "#| context: setup\r\n1 + 1" }, defaults)
tap.eq(crlf[1], "1 + 1", "extract: CRLF parses like LF")

local blanks = utils.extractCodeBlockOptions({ text = "#| context: setup\n\n\n1 + 1" }, defaults)
tap.eq(blanks[1], "1 + 1", "extract: leading blank lines are stripped")

tap.eq(select(2, utils.extractCodeBlockOptions({ text = "1 + 1" }, defaults))["context"],
       "interactive", "extract: defaults apply when no options given")
```

- [ ] **Step 2: Run it and verify it fails**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua
```

Expected: FAIL with `attempt to call a nil value (field 'buildDefaultCellOptions')`.

- [ ] **Step 3: Add the functions to `qwebr-utils.lua`**

Append before `return M`:

```lua
--- Build a fresh table of cell-option defaults.
--- `isRevealJS` is passed in because webr.lua owns the Quarto coupling.
function M.buildDefaultCellOptions(isRevealJS)
  return {
    ["context"] = "interactive",
    ["warning"] = "true",
    ["message"] = "true",
    ["results"] = "markup",
    ["output"] = "true",
    ["comment"] = "",
    ["label"] = "",
    ["autorun"] = "",
    ["read-only"] = "false",
    ["classes"] = "",
    ["dpi"] = 72,
    ["fig-cap"] = "",
    ["fig-width"] = 7,
    ["fig-height"] = 5,
    ["out-width"] = "700px",
    ["out-height"] = "",
    ["editor-font-scale"] = isRevealJS and "0.5" or "1",
    ["editor-max-height"] = "",
    ["editor-quick-suggestions"] = "false",
    ["editor-word-wrap"] = "true"
  }
end

--- Convert the communication channel meta option into a WebROptions.channelType
function M.convertMetaChannelTypeToWebROption(input)
  local conditions = {
    ["automatic"] = "ChannelType.Automatic",
    [0] = "ChannelType.Automatic",
    ["shared-array-buffer"] = "ChannelType.SharedArrayBuffer",
    [1] = "ChannelType.SharedArrayBuffer",
    ["service-worker"] = "ChannelType.ServiceWorker",
    [2] = "ChannelType.ServiceWorker",
    ["post-message"] = "ChannelType.PostMessage",
    [3] = "ChannelType.PostMessage",
  }
  return conditions[input] or "ChannelType.Automatic"
end

--- Merge local cell options over a defaults table.
function M.mergeCellOptions(defaults, localOptions)
  local mergedOptions = M.shallowcopy(defaults)
  for key, value in pairs(localOptions) do
    if type(value) == "string" then
      value = value:gsub("[\"']", "")
    end
    mergedOptions[key] = value
  end
  return mergedOptions
end

--- Extract Quarto code cell options from the block's text.
function M.extractCodeBlockOptions(block, defaults)
  local code = block.text
  local cellOptions = {}
  local newCodeLines = {}

  for line in code:gmatch("([^\r\n]*)[\r\n]?") do
    local key, value = line:match("^#|%s*(.-):%s*(.-)%s*$")
    if key and value then
      cellOptions[key] = value
    else
      table.insert(newCodeLines, line)
    end
  end

  cellOptions = M.mergeCellOptions(defaults, cellOptions)
  local restructuredCodeCell = M.removeEmptyLinesUntilContent(newCodeLines)

  return restructuredCodeCell, cellOptions
end
```

- [ ] **Step 4: Run it and verify it passes**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua; echo "exit=$?"
```

Expected: all `ok`, `exit=0`. If the two `KNOWN BUG` assertions fail, the behaviour was changed — that is a bug in this task, not a fix.

- [ ] **Step 5: Commit**

```bash
git add _extensions/webr/qwebr-utils.lua tests/_unit/lua/utils-cell-options.test.lua
git commit -m "test: cover cell option parsing and merging"
```

---

### Task 4: Rewire webr.lua onto the module

This is the only task that touches shipping behaviour. Keep the local names as
aliases so none of the ~30 existing call sites change — that is what makes this
diff reviewable.

**Files:**
- Modify: `_extensions/webr/webr.lua` (delete lines 106-183 and 217-223 and 402-413 and 586-636 region definitions; add the alias block)

**Interfaces:**
- Consumes: everything produced by Tasks 2 and 3.
- Produces: no new interface. `webr.lua` behaves exactly as before.

- [ ] **Step 1: Record the current output as a baseline**

```bash
cd tests && quarto render qwebr-test-multiple-cells.qmd --to html
cp _site/qwebr-test-multiple-cells.html /tmp/qwebr-baseline.html
cd ..
```

- [ ] **Step 2: Add the alias block near the top of `webr.lua`**

Insert immediately after the module-local declarations (after line 74, before `qwebRDefaultCellOptions`):

```lua
local utils = require("qwebr-utils")

-- Aliases keep every existing call site in this file unchanged.
local isVariableEmpty = utils.isVariableEmpty
local isVariablePopulated = utils.isVariablePopulated
local shallowcopy = utils.shallowcopy
local convertMetaChannelTypeToWebROption = utils.convertMetaChannelTypeToWebROption
local removeEmptyLinesUntilContent = utils.removeEmptyLinesUntilContent
local substitute_in_file = utils.substituteInFile
```

- [ ] **Step 3: Replace the defaults table**

Replace the whole `local qwebRDefaultCellOptions = { ... }` literal (lines 77-98) with:

```lua
-- Mutable: document metadata (webr.cell-options) overwrites entries in place.
local qwebRDefaultCellOptions = utils.buildDefaultCellOptions(quarto.doc.is_format("revealjs"))
```

- [ ] **Step 4: Replace the four functions whose signatures changed**

```lua
local function mergeCellOptions(localOptions)
  return utils.mergeCellOptions(qwebRDefaultCellOptions, localOptions)
end

local function extractCodeBlockOptions(block)
  return utils.extractCodeBlockOptions(block, qwebRDefaultCellOptions)
end

local function specifyBaseUrl()
  baseUrl = utils.buildBaseUrl(baseUrl, baseVersionWebR)
end
```

`specifyBaseUrl` is called exactly once per run — at line 248 on the early-return path, or at line 268 otherwise, never both — so replacing mutation-in-place with reassignment is safe.

- [ ] **Step 5: Delete the now-duplicated definitions**

Remove from `webr.lua`: `isVariableEmpty`, `isVariablePopulated`, `shallowcopy`, `table.clone`, the old `mergeCellOptions` body, `convertMetaChannelTypeToWebROption`, the old `specifyBaseUrl` body, `substitute_in_file`, `removeEmptyLinesUntilContent`, and the old `extractCodeBlockOptions` body.

Deleting `function table.clone` is safe: it is called from exactly one place (the old `mergeCellOptions`), which is also being replaced.

- [ ] **Step 6: Use `quoteAndJoin` at both list sites**

Replace the repos loop (around line 321):

```lua
  if isVariablePopulated(webr["repos"]) then
    local repoURLList = {}
    for _, repoURL in pairs(webr["repos"]) do
      repoURLList[#repoURLList + 1] = pandoc.utils.stringify(repoURL)
    end
    rPackageRepoURLS = utils.quoteAndJoin(repoURLList, defaultRepoURL)
  end
```

and the packages loop (around line 338):

```lua
  if isVariablePopulated(webr["packages"]) then
    local packageList = {}
    for _, packageName in pairs(webr["packages"]) do
      packageList[#packageList + 1] = pandoc.utils.stringify(packageName)
    end
    installRPackagesList = utils.quoteAndJoin(packageList)

    if isVariablePopulated(webr['autoload-packages']) then
      autoloadRPackages = pandoc.utils.stringify(webr["autoload-packages"])
    end
  end
```

`defaultRepoURL` is already stored pre-quoted, which is why it goes through the `extra` parameter rather than the list.

- [ ] **Step 7: Verify the render is byte-identical**

```bash
cd tests && quarto render qwebr-test-multiple-cells.qmd --to html && cd ..
diff /tmp/qwebr-baseline.html tests/_site/qwebr-test-multiple-cells.html && echo "IDENTICAL"
```

Expected: `IDENTICAL`. Any difference means the refactor changed behaviour — stop and investigate rather than re-baselining.

- [ ] **Step 8: Verify the whole demo site still renders**

```bash
cd tests && quarto render && cd ..
```

Expected: no errors. This is the real check that `require("qwebr-utils")` resolves through Quarto's extension loader.

- [ ] **Step 9: Run the Lua tests again**

```bash
quarto pandoc lua tests/_harness/run-lua-tests.lua; echo "exit=$?"
```

Expected: still all `ok`, `exit=0`.

- [ ] **Step 10: Commit**

```bash
git add _extensions/webr/webr.lua
git commit -m "refactor: move pure helpers into qwebr-utils"
```

---

### Task 5: Node scaffolding and the TAP bridge

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `tests/_unit/lua-bridge.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the TAP stream from Task 1's runner.
- Produces: `npm test` (all layers), `npm run test:lua`, `npm run test:fast`, `npm run test:e2e`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "quarto-webr-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:lua": "quarto pandoc lua tests/_harness/run-lua-tests.lua",
    "test:fast": "vitest run --exclude '**/_e2e/**'",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "cheerio": "^1.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/_unit/**/*.test.js', 'tests/_render/**/*.test.js'],
    testTimeout: 180000,
    hookTimeout: 180000,
  },
})
```

Timeouts are generous because `quarto render` dominates the render layer.

- [ ] **Step 3: Ignore Node and test output**

Append to `.gitignore`:

```
node_modules/
tests/_fixtures/*.html
tests/_fixtures/*_files/
tests/_fixtures/.quarto/
test-results/
playwright-report/
```

- [ ] **Step 4: Write the TAP bridge**

`tests/_unit/lua-bridge.test.js`. This turns each Lua assertion into its own vitest test, so a failure names the assertion instead of reporting one opaque non-zero exit:

```js
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
```

- [ ] **Step 5: Install and run**

```bash
npm install
npm run test:fast
```

Expected: the Lua assertions from Tasks 1-3 appear as individually named passing vitest tests.

- [ ] **Step 6: Prove the bridge reports failures**

Temporarily add `tap.eq(1, 2, "bridge check")` to `tests/_unit/lua/harness.test.lua`, run `npm run test:fast`, and confirm vitest fails a test *named* `bridge check` with the expected/actual diagnostic attached. Remove the line.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js tests/_unit/lua-bridge.test.js .gitignore
git commit -m "test: add vitest and bridge Lua TAP output into it"
```

---

### Task 6: Render layer

**Files:**
- Create: `tests/_fixtures/_extensions` (symlink to `../../_extensions`)
- Create: `tests/_fixtures/basic-cell.qmd`, `cell-options.qmd`, `multiple-cells.qmd`, `doc-metadata.qmd`
- Create: `tests/_harness/render.js`
- Test: `tests/_render/filter-output.test.js`

**Interfaces:**
- Consumes: the rewired filter from Task 4.
- Produces: `renderFixture(name) -> html`, `normalizeVersion(html) -> html`.

- [ ] **Step 1: Create the symlink**

```bash
mkdir -p tests/_fixtures
ln -s ../../_extensions tests/_fixtures/_extensions
git add tests/_fixtures/_extensions
```

Without this, `filters: [webr]` resolves against `tests/_fixtures/webr` and the render dies with "Could not run … as a JSON filter". Verified.

- [ ] **Step 2: Write the fixtures**

`tests/_fixtures/basic-cell.qmd`:

```markdown
---
title: Basic cell
format: html
engine: markdown
filters:
  - webr
---

```{webr-r}
1 + 1
```
```

`tests/_fixtures/cell-options.qmd`:

```markdown
---
title: Cell options
format: html
engine: markdown
filters:
  - webr
---

```{webr-r}
#| context: setup
#| autorun: false
#| read-only: true
1 + 1
```
```

`tests/_fixtures/multiple-cells.qmd`:

```markdown
---
title: Multiple cells
format: html
engine: markdown
filters:
  - webr
---

```{webr-r}
1 + 1
```

```{webr-r}
2 + 2
```

```{webr-r}
3 + 3
```
```

`tests/_fixtures/doc-metadata.qmd` — this is the only coverage for
`setWebRInitializationOptions`, which Task 4 deliberately leaves unextracted:

```markdown
---
title: Document metadata
format: html
engine: markdown
webr:
  channel-type: post-message
  home-dir: /home/rstudio
  packages: ['ggplot2']
filters:
  - webr
---

```{webr-r}
1 + 1
```
```

`engine: markdown` keeps R and Python out of CI entirely. Verified: the filter runs and emits correct output under it.

- [ ] **Step 3: Write the render helper**

`tests/_harness/render.js`:

```js
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
```

- [ ] **Step 4: Write the failing test**

`tests/_render/filter-output.test.js`:

```js
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
```

- [ ] **Step 5: Run and verify**

```bash
npm run test:fast
```

Expected: all pass. If "emits exactly one insertion point" reports more than one, the selector is matching a script-template reference as well as the div — tighten it to `div[id^=...]` rather than relaxing the count.

- [ ] **Step 6: Commit**

```bash
git add tests/_fixtures tests/_harness/render.js tests/_render
git commit -m "test: assert on filter-emitted HTML"
```

---

### Task 7: JavaScript unit layer

**Files:**
- Create: `tests/_harness/load-globals.js`
- Test: `tests/_unit/js/editor-helpers.test.js`
- Test: `tests/_unit/js/history-helpers.test.js`

No source JavaScript is modified.

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `loadBrowserScript(relativePath) -> context` where `context` holds the globals the script defined.

- [ ] **Step 1: Write the loader**

`tests/_harness/load-globals.js`:

```js
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

/**
 * The extension's browser scripts are plain globals, not modules, so they
 * cannot be imported. Evaluate one inside a jsdom context and hand back the
 * context so tests can reach the functions it defined.
 */
export function loadBrowserScript(relativePath, bodyHtml = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    runScripts: 'outside-only',
  })
  const source = readFileSync(path.resolve('_extensions/webr', relativePath), 'utf8')
  const context = dom.getInternalVMContext()
  vm.runInContext(source, context)
  return context
}
```

`bodyHtml` is not optional in practice. Several of these scripts assign event
handlers at load time on elements they look up by id — `qwebr-document-history.js`
does `command_history_btn.onclick = ...` at top level, which throws
`Cannot set properties of null` in an empty document. Seed the ids the script
expects rather than wrapping the eval in a try/catch, which would hide real
load-time breakage.

- [ ] **Step 2: Write the failing test**

`tests/_unit/js/editor-helpers.test.js`:

```js
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
```

- [ ] **Step 3: Write the history helper test**

`tests/_unit/js/history-helpers.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { loadBrowserScript } from '../../_harness/load-globals.js'

// These ids must exist before the script runs; it wires onclick handlers to
// them at load time and throws on null otherwise.
const SEED = `
  <div id="qwebr-history-modal"></div>
  <button id="qwebrRHistoryButton"></button>
  <span id="qwebr-command-history-close-btn"></span>
  <button id="qwebr-download-history-btn"></button>
  <div id="qwebr-command-history-contents"></div>
`

const context = loadBrowserScript('qwebr-document-history.js', SEED)

describe('formatDateTime', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 23, 9, 5, 3))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('pads every component to two digits', () => {
    expect(context.formatDateTime()).toBe('2026-08-23-09-05-03')
  })
})

describe('safeFileName', () => {
  it('replaces characters that are unsafe in a filename', () => {
    context.document.title = 'Test: "webR"/demo?'
    const result = context.safeFileName()
    expect(result).toMatch(/^Rhistory-/)
    expect(result).not.toMatch(/[\\/:*?!"<>|]/)
  })
})
```

`vi.setSystemTime` uses a local-time constructor because `formatDateTime` reads
`getFullYear`/`getHours`, not their UTC counterparts.

- [ ] **Step 4: Run and verify**

```bash
npm run test:fast
```

If `context.isValidCodeLineNumbers` is undefined, the function declaration did not become a context global — wrap the source as `${source}\n;globalThis.isValidCodeLineNumbers = isValidCodeLineNumbers;` in the loader rather than changing the extension source.

- [ ] **Step 5: Commit**

```bash
git add tests/_harness/load-globals.js tests/_unit/js
git commit -m "test: cover pure browser helpers with jsdom"
```

---

### Task 8: Browser smoke layer

**Files:**
- Create: `tests/_harness/serve.js`
- Create: `playwright.config.js`
- Test: `tests/_e2e/webr-runs.spec.js`

**Interfaces:**
- Consumes: `renderFixture` from Task 6.
- Produces: `startServer(root) -> { server, port }`.

- [ ] **Step 1: Write the isolating static server**

`tests/_harness/serve.js`. The COOP/COEP headers are what let `ChannelType.Automatic` resolve to SharedArrayBuffer — the path real users get:

```js
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
}

export function startServer(root) {
  const server = http.createServer(async (request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const filePath = path.join(root, urlPath === '/' ? '/index.html' : urlPath)

    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

    try {
      const body = await readFile(filePath)
      response.setHeader('Content-Type', CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream')
      response.end(body)
    } catch {
      response.statusCode = 404
      response.end('not found')
    }
  })

  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }))
  })
}
```

- [ ] **Step 2: Write the Playwright config**

`playwright.config.js`:

```js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/_e2e',
  timeout: 180000,
  expect: { timeout: 120000 },
  retries: 1,
  use: { headless: true },
})
```

One retry, because webR boot over the network is genuinely slow rather than genuinely flaky.

- [ ] **Step 3: Write the smoke test**

`tests/_e2e/webr-runs.spec.js`:

```js
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { startServer } from '../_harness/serve.js'
import { renderFixture } from '../_harness/render.js'

let server
let baseURL

test.beforeAll(async () => {
  renderFixture('basic-cell')
  const started = await startServer(path.resolve('tests/_fixtures'))
  server = started.server
  baseURL = `http://localhost:${started.port}`
})

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('webR boots and executes a cell', async ({ page }) => {
  await page.goto(`${baseURL}/basic-cell.html`)

  // The run button is disabled until webR finishes booting. Waiting on the
  // button rather than the status text works even when the startup message
  // is suppressed.
  const runButton = page.locator('#qwebr-button-run-1')
  await expect(runButton).toBeEnabled({ timeout: 120000 })

  await runButton.click()

  await expect(page.locator('#qwebr-output-code-area-1')).toContainText('2', {
    timeout: 60000,
  })
})

test('the status indicator reaches ready', async ({ page }) => {
  await page.goto(`${baseURL}/basic-cell.html`)
  await expect(page.locator('#qwebr-status-message-text')).toHaveText(/Ready/, {
    timeout: 120000,
  })
})
```

The second test depends on the startup message being displayed, which is the
default. Do not add `show-startup-message: false` to `basic-cell.qmd`.

- [ ] **Step 4: Install browsers and run**

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Expected: both tests pass. `1 + 1` renders as `2` in the output area.

- [ ] **Step 5: Prove the layer can fail**

Temporarily change the assertion to `toContainText('999')`, re-run, confirm it fails, then change it back. If it "passes" against 999, the locator is matching an empty element and the test proves nothing.

- [ ] **Step 6: Commit**

```bash
git add tests/_harness/serve.js playwright.config.js tests/_e2e
git commit -m "test: add browser smoke test for webR execution"
```

---

### Task 9: CI

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Tests

on:
  push:
  pull_request:
  schedule:
    - cron: '0 6 * * *'

jobs:
  fast:
    name: Lua, render, and JS tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: quarto-dev/quarto-actions/setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Lua unit tests
        run: npm run test:lua
      - name: Render and JS tests
        run: npm run test:fast

  browser:
    name: Browser smoke test
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || contains(github.event.pull_request.labels.*.name, 'webr-update')
    steps:
      - uses: actions/checkout@v5
      - uses: quarto-dev/quarto-actions/setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

No R and no Python setup: fixtures use `engine: markdown`. The `browser` job runs
nightly and on release-bot PRs (which carry the `webr-update` label), which is
exactly where a webR runtime break would otherwise reach main unnoticed.

- [ ] **Step 2: Verify the workflow parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml')); print('YAML OK')"
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run the test suite"
git push -u origin tests/automated-suite
```

- [ ] **Step 4: Confirm CI is green**

```bash
gh run list --workflow=test.yml --limit 1
gh run watch "$(gh run list --workflow=test.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: the `fast` job passes and the `browser` job is skipped (no `webr-update` label on this branch). Do not claim the suite works until this output is seen.
