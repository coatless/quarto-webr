-----
---- Setup variables for default initialization

--- Define a variable to check if webR is present.
---@type boolean
local missingWebRCell = true

--- Define a variable to check if webR was initialized for the page
---@type boolean
local hasDoneWebRSetup = false

---- Setup default initialization values
--- Default values taken from:
--- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html

--- Define a base compatibile version
---@type string
local baseVersionWebR = "0.6.0"

--- Define where webR can be found
---@type string
local baseUrl = "https://webr.r-wasm.org/"

--- Define a custom location for webR, set by the `base-url` option
---@type string|nil
local customBaseUrl = nil

--- Define where webR service workers are located
---@type string
local serviceWorkerUrl = ""

--- Define the webR communication protocol
---@type string
local channelType = "ChannelType.Automatic"

--- Define a variable to suppress exporting service workers if not required.
--- (e.g. skipped for PostMessage or SharedArrayBuffer)
---@type boolean
local hasServiceWorkerFiles = false

--- Define user directory
---@type string
local homeDir = "/home/web_user"

--- Define whether a startup message should be displayed
---@type string
local showStartUpMessage = "true"

--- Define whether header type messages should be displayed
---@type string
local showHeaderMessage = "false"

--- Define a default repository URL
---@type string
local defaultRepoURL = "'https://repo.r-wasm.org/'"

--- Define possible repo URLs
---@type string
local rPackageRepoURLS = defaultRepoURL

--- Define an empty string if no packages need to be installed.
---@type string
local installRPackagesList = "''"

--- Define whether R packages should automatically be loaded
---@type string
local autoloadRPackages = "true"

-----
---- Types shared by the functions below

--- Where Quarto can include text in the page
---@alias IncludeLocation 'in-header'|'before-body'|'after-body'

--- The kind of HTML element that wraps included content
---@alias HtmlTag 'js'|'css'

--- One webR cell, as the page's scripts receive it
---@class QwebrCellData
---@field id integer Position of the cell in the document, starting at 1
---@field code string Cell code without the `#|` option lines
---@field options QwebrCellOptions

-----

---- Setup variables for tracking number of code cells

--- Define a counter variable
---@type integer
local qwebrCounter = 0

--- Initialize a table to store the CodeBlock elements
---@type QwebrCellData[]
local qwebrCapturedCodeBlocks = {}

local utils = require("qwebr-utils")

--- Initialize a table that contains the default cell-level options
--- Mutable: document metadata (webr.cell-options) overwrites entries in place.
local qwebRDefaultCellOptions = utils.buildDefaultCellOptions(quarto.doc.is_format("revealjs"))

-----
---- Process initialization

--- Write a file next to this filter
---@param contents string
---@param file_name string
local function writeFile(contents, file_name)
  -- Force resolve file name
  file_name = quarto.utils.resolve_path(file_name) 

  -- Open the file in write mode
  local file = io.open(file_name, "w")
  
  -- Check if the file was opened successfully
  if not file then
    quarto.log.error("Unable to open file for writing at '" .. file_name .. "'")
    return
  end

  -- Write contents to the file
  file:write(contents .. "\n")
    
  -- Close the file
  file:close()
end

--- Read every entry of a `webr:` list option as a string
---@param value table
---@return string[]
local function stringifyEach(value)
  local strings = {}
  for _, entry in pairs(value) do
    strings[#strings + 1] = pandoc.utils.stringify(entry)
  end
  return strings
end

--- Each option of the `webr` key in the YAML frontmatter, e.g.
---
--- ```yaml
--- ----
--- webr:
---   base-url: https://webr.r-wasm.org/[version]
---   service-worker-url: path/to/workers/{webr-serviceworker.js, webr-worker.js}
--- ----
--- ```
---
--- with the function that applies it. Options are applied in this order, so
--- `show-header-message` can switch on the startup message after
--- `show-startup-message` is read.
---@type { key: string, apply: fun(value: pandoc.MetaValue, webr: table) }[]
local webrOptions = {
  -- Allow modification of code cells global defaults 
  { key = "cell-options",
    ---@param value table
    apply = function(value)
      for index, option in pairs(value) do
        qwebRDefaultCellOptions[index] = pandoc.utils.stringify(option)
      end
    end },
  
  -- The version number used to access the webr.mjs on the baseURL 
  -- https://webr.r-wasm.org/v[version]/webr.mjs
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#baseurl
  { key = "version", apply = function(value)
    baseVersionWebR = pandoc.utils.stringify(value)
  end },

  -- The base URL used for downloading R WebAssembly binaries, which replaces
  -- the versioned default.
  -- https://webr.r-wasm.org/[version]/webr.mjs
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#baseurl
  { key = "base-url", apply = function(value, webr)
    customBaseUrl = pandoc.utils.stringify(value)
    if utils.isVariablePopulated(webr["version"]) then
      quarto.log.warning("Please do not specify both `base-url` and `version`. Using the `base-url` value to obtain webR.")
    end 
  end },

  -- The communication channel mode webR uses to connect R with the web browser 
  -- Default: "ChannelType.Automatic"
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#channeltype
  { key = "channel-type", apply = function(value)
    channelType = utils.convertMetaChannelTypeToWebROption(pandoc.utils.stringify(value))
    
    -- Starting from webR v0.2.2, service workers are only deployed when explicitly requested.
    hasServiceWorkerFiles = (channelType == "ChannelType.ServiceWorker")
  end },

  -- The base URL from where to load JavaScript worker scripts when loading webR
  -- with the ServiceWorker communication channel mode.
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#serviceworkerurl
  { key = "service-worker-url", apply = function(value)
    serviceWorkerUrl = pandoc.utils.stringify(value)
  end },

  -- The WebAssembly user's home directory and initial working directory. Default: '/home/web_user'
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#homedir
  { key = "home-dir", apply = function(value)
    homeDir = pandoc.utils.stringify(value)
  end },

  -- Display a startup message indicating the WebR state at the top of the document.
  { key = "show-startup-message", apply = function(value)
    showStartUpMessage = pandoc.utils.stringify(value)
  end },

  -- Display a header message, which needs the startup message.
  { key = "show-header-message", apply = function(value)
    showHeaderMessage = pandoc.utils.stringify(value)
    if showHeaderMessage == "true" then
      showStartUpMessage = "true"
    end
  end },

  -- Search these repositories for packages, ahead of the default one.
  { key = "repos",
    ---@param value table
    apply = function(value)
      rPackageRepoURLS = utils.quoteAndJoin(stringifyEach(value), defaultRepoURL)
    end },

  -- Attempt to install different packages, and decide whether to load them.
  { key = "packages",
    ---@param value table
    ---@param webr table
    apply = function(value, webr)
      installRPackagesList = utils.quoteAndJoin(stringifyEach(value))

      if utils.isVariablePopulated(webr["autoload-packages"]) then
        autoloadRPackages = pandoc.utils.stringify(webr["autoload-packages"])
      end
    end },
}

--- Parse the different webr options set in the YAML frontmatter.
---@param meta pandoc.Meta
---@return pandoc.Meta
local function setWebRInitializationOptions(meta)

  -- Retrieve the webr options from meta. Without them, the defaults apply.
  local webr = meta.webr
  if type(webr) == "table" then
    for _, option in ipairs(webrOptions) do
      if utils.isVariablePopulated(webr[option.key]) then
        option.apply(webr[option.key], webr)
      end
    end
  end

  baseUrl = customBaseUrl or utils.buildBaseUrl(baseUrl, baseVersionWebR)
  
  return meta
end


--- Obtain the contents in a template file
---@param template string
---@return string
local function readTemplateFile(template)
  -- Establish a hardcoded path to where the .html partial resides
  -- Note, this should be at the same level as the lua filter.
  -- This is crazy fragile since Lua lacks a directory representation (!?!?)
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  local path = quarto.utils.resolve_path(template) 

  -- Let's hopefully read the template file... 

  -- Open the template file, and stop the render if that fails. Quarto's
  -- error() only logs, and every caller needs the contents.
  local file = assert(io.open(path, "r"),
          "\nWe were unable to read the template file `" .. template .. "` from the extension directory.\n\n" ..
          "Double check that the extension is fully available by comparing the \n" ..
          "`_extensions/coatless/webr` directory with the main repository:\n" ..
          "https://github.com/coatless/quarto-webr/tree/main/_extensions/webr\n\n" ..
          "You may need to modify `.gitignore` to allow the extension files using:\n" ..
          "!_extensions/*/*/*\n")

  -- *a or *all reads the whole file
  local content = file:read "*a" 

  -- Close the file
  file:close()

  -- Return contents
  return content
end

-----

--- Pass document-level data into the header to initialize the document.
---@return string
local function initializationWebRDocumentSettings()

  -- Setup different WebR specific initialization variables
  local substitutions = {
    ["SHOWSTARTUPMESSAGE"] = showStartUpMessage, -- tostring()
    ["SHOWHEADERMESSAGE"] = showHeaderMessage,
    ["BASEURL"] = baseUrl, 
    ["CHANNELTYPE"] = channelType,
    ["SERVICEWORKERURL"] = serviceWorkerUrl, 
    ["HOMEDIR"] = homeDir,
    ["INSTALLRPACKAGESLIST"] = installRPackagesList,
    ["AUTOLOADRPACKAGES"] = autoloadRPackages,
    ["RPACKAGEREPOURLS"] = rPackageRepoURLS,
    ["QWEBRCELLDETAILS"] = utils.escapeForInlineScript(quarto.json.encode(qwebrCapturedCodeBlocks))
  }
  
  -- Make sure we perform a copy
  local initializationTemplate = readTemplateFile("qwebr-document-settings.js")

  -- Make the necessary substitutions
  return utils.substituteInFile(initializationTemplate, substitutions)
end

--- Opening and closing HTML tags for JS or CSS content
---@type table<HtmlTag, { opening: string, closing: string }>
local htmlTags = {
  js = { opening = "<script type=\"module\">\n", closing = "\n</script>" },
  css = { opening = "<style type=\"text/css\">\n", closing = "\n</style>" }
}

---- Custom functions to include values into Quarto
---- https://quarto.org/docs/extensions/lua-api.html#includes

---Place text content into an appropriate HTML element
---for the content.
---@param location IncludeLocation
---@param text string
---@param tag HtmlTag
local function includeTextInHTMLTag(location, text, tag)

  -- Insert the text into the document using the correct opening and closing tags
  local htmlTag = htmlTags[tag]
  quarto.doc.include_text(location, htmlTag.opening .. text .. htmlTag.closing)

end

---Read information from a template file and place it into the appropriate HTML element
---for the content.
---@param location IncludeLocation
---@param file string
---@param tag HtmlTag
local function includeFileInHTMLTag(location, file, tag)
  includeTextInHTMLTag(location, readTemplateFile(file), tag)
end

--- Setup WebR's pre-requisites once per document.
local function ensureWebRSetup()
  
  -- If we've included the initialization, then bail.
  if hasDoneWebRSetup then
    return
  end
  
  -- Otherwise, let's include the initialization script _once_
  hasDoneWebRSetup = true

  -- Embed Support Files to Avoid Resource Registration Issues
  -- Note: We're not able to use embed-resources due to the web assembly binary and the potential for additional service worker files.
  quarto.doc.include_text("in-header", [[
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs/editor/editor.main.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
  ]])

  -- Insert the extension styling for defined elements
  includeFileInHTMLTag("in-header", "qwebr-styling.css", "css")

  -- Insert the customized startup procedure
  includeTextInHTMLTag("in-header", initializationWebRDocumentSettings(), "js")

  -- Insert JS routine to add document status header
  includeFileInHTMLTag("in-header", "qwebr-document-status.js", "js")

  -- Insert the document history script
  includeFileInHTMLTag("in-header", "qwebr-document-history.js", "js")

  -- Insert the extension element creation scripts
  includeFileInHTMLTag("in-header", "qwebr-cell-elements.js", "js")

  -- Insert JS routine to bring webR online
  includeFileInHTMLTag("in-header", "qwebr-document-engine-initialization.js", "js")

  -- Insert the cell data at the end of the document
  includeFileInHTMLTag("after-body", "qwebr-cell-initialization.js", "js")

  -- Insert the extension computational engine that calls webR
  includeFileInHTMLTag("in-header", "qwebr-compute-engine.js", "js")

  -- Insert the monaco editor initialization
  quarto.doc.include_file("before-body", "qwebr-monaco-editor-init.html")

  includeFileInHTMLTag("before-body", "qwebr-theme-switch.js", "js")

  -- Insert the extension styling for defined elements
  includeFileInHTMLTag("before-body", "qwebr-monaco-editor-element.js", "js")

  -- If the ChannelType requires service workers, register and copy them into the 
  -- output directory.
  if hasServiceWorkerFiles then 
    -- Dynamically create the webr worker and serviceworker, then register them
    -- so Quarto copies them next to the document.
    -- https://quarto.org/docs/extensions/lua-api.html#dependencies
    for _, worker in ipairs({ "webr-worker", "webr-serviceworker" }) do
      local workerFile = worker .. ".js"
      writeFile("importScripts('" .. baseUrl .. workerFile .. "');", workerFile)

      quarto.doc.add_html_dependency({
        name = worker,
        version = baseVersionWebR,
        serviceworkers = { workerFile }
      })
    end
  end

end

---Design an HTML Element location in the document using the current cell ID. 
---@param counter integer
---@return string
local function qwebrJSCellInsertionCode(counter)
  local insertionLocation = '<div id="qwebr-insertion-location-' .. counter ..'"></div>\n'
  local noscriptWarning = '<noscript>Please enable JavaScript to experience the dynamic code cell content on this page.</noscript>'
  return insertionLocation .. noscriptWarning
end 

--- Replace the code cell with a webR-powered cell
---@param el pandoc.CodeBlock
---@return pandoc.Block
local function enableWebRCodeCell(el)
      
  -- Let's see what's going on here:
  -- quarto.log.output(el)
  
  -- Should display the following elements:
  -- https://pandoc.org/lua-filters.html#type-codeblock
  
  -- Verify the element has attributes and the document can run webR cells
  if not (el.attr and utils.isWebRFormat(quarto.doc.is_format)) then
    return el
  end

  -- Check to see if any form of the {webr} tag is present 

  -- Look for the original compute cell type `{webr}` 
  -- If the compute engine is:
  -- - jupyter: this appears as `{webr}` 
  -- - knitr: this appears as `webr`
  --  since the later dislikes custom engines
  local originalEngine = el.attr.classes:includes("{webr}") or el.attr.classes:includes("webr")

  -- Check for the new engine syntax that allows for the cell to be 
  -- evaluated in VS Code or RStudio editor views, c.f.
  -- https://github.com/quarto-dev/quarto-cli/discussions/4761#discussioncomment-5336636
  local newEngine = el.attr.classes:includes("{webr-r}")
  
  if not (originalEngine or newEngine) then
    return el
  end

  -- We detected a webR cell
  missingWebRCell = false
  
  -- Modify the counter variable each time this is run to create
  -- unique code cells
  qwebrCounter = qwebrCounter + 1

  -- Convert webr-specific option commands into attributes
  local cellCode, cellOptions = utils.extractCodeBlockOptions(el, qwebRDefaultCellOptions)

  -- Ensure we have a label representation
  if cellOptions["label"] == '' then
    cellOptions["label"] = "unnamed-chunk-" .. qwebrCounter
  end
  -- Set autorun to false if interactive
  if cellOptions["autorun"] == "" then
    if cellOptions["context"] == "interactive" then
      cellOptions["autorun"] = "false"
    else
      cellOptions["autorun"] = "true"
    end
  end

  -- Store the cell in the global table, with the codeblock text excluding
  -- the special comments.
  table.insert(qwebrCapturedCodeBlocks, {
    id = qwebrCounter,
    code = table.concat(cellCode, '\n'),
    options = cellOptions
  })

  -- Return an insertion point inside the document. Plain is what pandoc
  -- would wrap a bare RawInline in; a RawBlock changes dashboard layout.
  return pandoc.Plain({ pandoc.RawInline('html', qwebrJSCellInsertionCode(qwebrCounter)) })
end

---Add webR setup into the Quarto document if cell is detected
---@param doc pandoc.Pandoc
---@return pandoc.Pandoc
local function stitchDocument(doc)

  -- Do not attach webR as the page lacks any active webR cells
  if missingWebRCell then 
    return doc
  end

  -- Make sure we've initialized the code block
  ensureWebRSetup()

  return doc
end

return {
  {
    Meta = setWebRInitializationOptions
  }, 
  {
    CodeBlock = enableWebRCodeCell
  }, 
  {
    Pandoc = stitchDocument
  }
}

