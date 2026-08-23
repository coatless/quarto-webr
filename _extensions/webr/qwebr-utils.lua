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
