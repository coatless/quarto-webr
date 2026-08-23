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
