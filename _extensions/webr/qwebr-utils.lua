--- Pure helpers for the quarto-webr filter.
---
--- This module deliberately references no `quarto` and no `pandoc` global so
--- that the test harness can load it directly. Anything format-dependent is
--- passed in as a parameter by webr.lua.
local M = {}

--- Options for one webR cell: the defaults, overridden by `webr.cell-options`
--- and then by the cell's `#|` lines. Values read from a document are strings,
--- so only an untouched numeric default is still a number. Unknown keys pass
--- through.
---@class QwebrCellOptions: { [string]: string|number }
---@field context string `interactive`, `setup` or `output`
---@field warning string
---@field message string
---@field results string
---@field output string
---@field comment string
---@field label string
---@field autorun string `true` or `false`; empty until webr.lua resolves it
---@field ["read-only"] string
---@field classes string
---@field dpi integer|string
---@field ["fig-cap"] string
---@field ["fig-width"] integer|string
---@field ["fig-height"] integer|string
---@field ["out-width"] string
---@field ["out-height"] string
---@field ["editor-font-scale"] string
---@field ["editor-max-height"] string
---@field ["editor-quick-suggestions"] string
---@field ["editor-word-wrap"] string

--- Check if variable missing or an empty string
---@param s pandoc.MetaValue|nil
---@return boolean
function M.isVariableEmpty(s)
  return s == nil or s == ''
end

--- Check if variable is present
---@param s pandoc.MetaValue|nil
---@return boolean
function M.isVariablePopulated(s)
  return not M.isVariableEmpty(s)
end

--- Copy the top level value and its direct children
---@generic T
---@param original T
---@return T
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
---@param base string
---@param version string A webR version such as `0.6.0`, or `latest`
---@return string
function M.buildBaseUrl(base, version)
  if version == "latest" then
    return base .. "latest/"
  end
  return base .. "v" .. version .. "/"
end

--- Wrap each value in single quotes and join with ", ".
--- `extra` is appended verbatim (it is expected to be pre-quoted).
---@param values string[]
---@param extra? string
---@return string
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
---@param contents string
---@param substitutions table<string, string> Replacement text for each WORD
---@return string
function M.substituteInFile(contents, substitutions)
  return (contents:gsub("{{%s*(.-)%s*}}", substitutions))
end

--- Make JSON safe to place inside an inline <script> element.
--- `<` only appears inside JSON strings, so `\u003c` keeps the data identical
--- while cell code such as `</script>` or `<!-- <script>` can no longer end
--- the element early or switch the HTML parser into a script-escape state.
---@param json string
---@return string
function M.escapeForInlineScript(json)
  return (json:gsub("<", "\\u003c"))
end

--- Remove lines with only whitespace until the first non-whitespace character.
---@param codeLines string[] Modified in place
---@return string[]
function M.removeEmptyLinesUntilContent(codeLines)
  while codeLines[1] and string.match(codeLines[1], "^%s*$") do
    table.remove(codeLines, 1)
  end
  return codeLines
end

--- Build a fresh table of cell-option defaults.
--- `isRevealJS` is passed in because webr.lua owns the Quarto coupling.
---@param isRevealJS boolean
---@return QwebrCellOptions
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

--- Check whether the output format can host webR cells: HTML that runs
--- JavaScript, or Markdown. EPUB counts as "html" but runs no scripts, so it
--- keeps the plain code block.
--- `isFormat` is passed in (quarto.doc.is_format) because webr.lua owns the Quarto coupling.
---@param isFormat fun(name: string): boolean
---@return boolean
function M.isWebRFormat(isFormat)
  return isFormat("html:js") or isFormat("markdown")
end

--- Convert the communication channel meta option into a WebROptions.channelType
--- The filter stringifies metadata, so the integer forms arrive as "0" to "3".
---@param input string|integer A channel name such as `post-message`, or 0 to 3
---@return string
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
  return conditions[input] or conditions[tonumber(input)] or "ChannelType.Automatic"
end

--- Merge local cell options over a defaults table.
--- A matched pair of surrounding quotes is removed; quotes inside the value stay.
---@param defaults QwebrCellOptions
---@param localOptions table<string, string>
---@return QwebrCellOptions
function M.mergeCellOptions(defaults, localOptions)
  local mergedOptions = M.shallowcopy(defaults)
  for key, value in pairs(localOptions) do
    if type(value) == "string" then
      value = value:match('^"(.*)"$') or value:match("^'(.*)'$") or value
    end
    mergedOptions[key] = value
  end
  return mergedOptions
end

--- Extract Quarto code cell options from the block's text.
---@param block { text: string } A pandoc.CodeBlock, or any table with its text
---@param defaults QwebrCellOptions
---@return string[] code The code lines without `#|` option lines
---@return QwebrCellOptions options
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

return M
