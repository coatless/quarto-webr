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
