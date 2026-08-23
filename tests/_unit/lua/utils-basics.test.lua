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
