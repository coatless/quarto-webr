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
