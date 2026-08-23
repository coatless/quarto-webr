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

return M
