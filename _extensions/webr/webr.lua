----
--- Setup variables for default initialization

-- Define a variable to check if webR is present.
local missingWebRCell = true

-- Define a variable to check if webR was initialized for the page
local hasDoneWebRSetup = false

--- Setup default initialization values
-- Default values taken from:
-- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html

-- Define a base compatibile version
local baseVersionWebR = "0.2.2"

-- Define where WebR can be found
local baseUrl = "https://webr.r-wasm.org/v".. baseVersionWebR .."/"
local serviceWorkerUrl = ""

-- Define the webR communication protocol
local channelType = "ChannelType.Automatic"

-- Define a variable to suppress exporting service workers if not required.
-- (e.g. skipped for PostMessage or SharedArrayBuffer)
local hasServiceWorkerFiles = true

-- Define user directory
local homeDir = "/home/web_user"

-- Define whether a startup message should be displayed
local showStartUpMessage = "true"

-- Define whether header type messages should be displayed
local showHeaderMessage = "false"

-- Define a default repository URL
local defaultRepoURL = "'https://repo.r-wasm.org/'"

-- Define possible repo URLs
local rPackageRepoURLS = defaultRepoURL

-- Define an empty string if no packages need to be installed.
local installRPackagesList = "''"

-- Define whether R packages should automatically be loaded
local autoloadRPackages = "true"
----

--- Setup variables for tracking number of code cells

-- Define a counter variable
local qwebrCounter = 0

-- Initialize a table to store the CodeBlock elements
local qwebrCapturedCodeBlocks = {}

-- Initialize a table that contains the default cell-level options
local qwebRDefaultCellOptions = {
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
  ["out-height"] = ""
}

----
--- Process initialization

-- Check if variable missing or an empty string
local function isVariableEmpty(s)
  return s == nil or s == ''
end

-- Check if variable is present
local function isVariablePopulated(s)
  return not isVariableEmpty(s)
end

-- Copy the top level value and its direct children
-- Details: http://lua-users.org/wiki/CopyTable
local function shallowcopy(original)
  -- Determine if its a table
  if type(original) == 'table' then
    -- Copy the top level to remove references
    local copy = {}
    for key, value in pairs(original) do
        copy[key] = value
    end
    -- Return the copy
    return copy
  else
    -- If original is not a table, return it directly since it's already a copy
    return original
  end
end

-- Custom method for cloning a table with a shallow copy.
function table.clone(original)
  return shallowcopy(original)
end

local function mergeCellOptions(localOptions)
  -- Copy default options to the mergedOptions table
  local mergedOptions = table.clone(qwebRDefaultCellOptions)

  -- Override default options with local options
  for key, value in pairs(localOptions) do
    if type(value) == "string" then
      value = value:gsub("[\"']", "")
    end
    mergedOptions[key] = value
  end

  -- Return the customized options
  return mergedOptions
end

-- Convert the communication channel meta option into a WebROptions.channelType option
local function convertMetaChannelTypeToWebROption(input)
  -- Create a table of conditions
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
  -- Subset the table to obtain the communication channel.
  -- If the option isn't found, return automatic.
  return conditions[input] or "ChannelType.Automatic"
end


-- Parse the different webr options set in the YAML frontmatter, e.g.
--
-- ```yaml
-- ----
-- webr:
--   base-url: https://webr.r-wasm.org/[version]
--   service-worker-url: path/to/workers/{webr-serviceworker.js, webr-worker.js}
-- ----
-- ```
--
-- 
function setWebRInitializationOptions(meta)

  -- Let's explore the meta variable data! 
  -- quarto.log.output(meta)
  
  -- Retrieve the webr options from meta
  local webr = meta.webr

  -- Does this exist? If not, just return meta as we'll just use the defaults.
  if isVariableEmpty(webr) then
    return meta
  end

  -- The base URL used for downloading R WebAssembly binaries 
  -- https://webr.r-wasm.org/[version]/webr.mjs
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#baseurl
  if isVariablePopulated(webr["base-url"]) then
    baseUrl = pandoc.utils.stringify(webr["base-url"])
  end

  -- The communication channel mode webR uses to connect R with the web browser 
  -- Default: "ChannelType.Automatic"
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#channeltype
  if isVariablePopulated(webr["channel-type"]) then
    channelType = convertMetaChannelTypeToWebROption(pandoc.utils.stringify(webr["channel-type"]))
    
    -- Starting from webR v0.2.2, service workers are only deployed when explicitly requested.
    hasServiceWorkerFiles = (channelType == "ChannelType.ServiceWorker")
  end

  -- The base URL from where to load JavaScript worker scripts when loading webR
  -- with the ServiceWorker communication channel mode.
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#serviceworkerurl
  if isVariablePopulated(webr["service-worker-url"]) then
    serviceWorkerUrl = pandoc.utils.stringify(webr["service-worker-url"])
  end

  -- The WebAssembly user's home directory and initial working directory. Default: '/home/web_user'
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#homedir
  if isVariablePopulated(webr['home-dir']) then
    homeDir = pandoc.utils.stringify(webr["home-dir"])
  end

  -- Display a startup message indicating the WebR state at the top of the document.
  if isVariablePopulated(webr['show-startup-message']) then
    showStartUpMessage = pandoc.utils.stringify(webr["show-startup-message"])
  end

  -- Display a startup message indicating the WebR state at the top of the document.
  if isVariablePopulated(webr['show-header-message']) then
    showHeaderMessage = pandoc.utils.stringify(webr["show-header-message"])
    if showHeaderMessage == "true" then
      showStartUpMessage = "true"
    end
  end

  -- Attempt to install different packages.
  if isVariablePopulated(webr["repos"]) then
    -- Create a custom list
    local repoURLList = {}

    -- Iterate through each list item and enclose it in quotes
    for _, repoURL in pairs(webr["repos"]) do
      table.insert(repoURLList, "'" .. pandoc.utils.stringify(repoURL) .. "'")
    end
    
    -- Add default repo URL
    table.insert(repoURLList, defaultRepoURL)

    -- Combine URLs
    rPackageRepoURLS = table.concat(repoURLList, ", ")
  end

  -- Attempt to install different packages.
  if isVariablePopulated(webr["packages"]) then
    -- Create a custom list
    local package_list = {}

    -- Iterate through each list item and enclose it in quotes
    for _, package_name in pairs(webr["packages"]) do
      table.insert(package_list, "'" .. pandoc.utils.stringify(package_name) .. "'")
    end

    installRPackagesList = table.concat(package_list, ", ")

    if isVariablePopulated(webr['autoload-packages']) then
      autoloadRPackages = pandoc.utils.stringify(webr["autoload-packages"])
    end

  end
  
  return meta
end


-- Obtain a template file
local function readTemplateFile(template)
  -- Establish a hardcoded path to where the .html partial resides
  -- Note, this should be at the same level as the lua filter.
  -- This is crazy fragile since Lua lacks a directory representation (!?!?)
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  local path = quarto.utils.resolve_path(template) 

  -- Let's hopefully read the template file... 

  -- Open the template file
  local file = io.open(path, "r")

  -- Check if null pointer before grabbing content
  if not file then        
    error("\nWe were unable to read the template file `" .. template .. "` from the extension directory.\n\n" ..
          "Double check that the extension is fully available by comparing the \n" ..
          "`_extensions/coatless/webr` directory with the main repository:\n" ..
          "https://github.com/coatless/quarto-webr/tree/main/_extensions/webr\n\n" ..
          "You may need to modify `.gitignore` to allow the extension files using:\n" ..
          "!_extensions/*/*/*\n")
    return nil
  end

  -- *a or *all reads the whole file
  local content = file:read "*a" 

  -- Close the file
  file:close()

  -- Return contents
  return content
end

----

-- Define a function to replace keywords given by {{ WORD }}
-- Is there a better lua-approach?
local function substitute_in_file(contents, substitutions)

  -- Substitute values in the contents of the file
  contents = contents:gsub("{{%s*(.-)%s*}}", substitutions)

  -- Return the contents of the file with substitutions
  return contents
end

-- Define a function that escape control sequence
local function escapeControlSequences(str)
  -- Perform a global replacement on the control sequence character
  return str:gsub("[\\%c]", function(c)
    if c == "\\" then
      -- Escape backslash
      return "\\\\"
    end
  end)
end

----

-- Pass document-level data into the header to initialize the document.
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
    ["QWEBRCELLDETAILS"] = quarto.json.encode(qwebrCapturedCodeBlocks)
    -- ["VERSION"] = baseVersionWebR
  }
  
  -- Make sure we perform a copy
  local initializationTemplate = readTemplateFile("qwebr-document-settings.js")

  -- Make the necessary substitutions
  local initializedWebRConfiguration = substitute_in_file(initializationTemplate, substitutions)

  return initializedWebRConfiguration
end

local function generateHTMLElement(tag)
  -- Store a map containing opening and closing tabs
  local tagMappings = {
      js = { opening = "<script type=\"module\">\n", closing = "\n</script>" },
      css = { opening = "<style type=\"text/css\">\n", closing = "\n</style>" }
  }

  -- Find the tag
  local tagMapping = tagMappings[tag]

  -- If present, extract tag and return
  if tagMapping then
      return tagMapping.opening, tagMapping.closing
  else
      quarto.log.error("Invalid tag specified")
  end
end

-- Custom functions to include values into Quarto
-- https://quarto.org/docs/extensions/lua-api.html#includes

local function includeTextInHTMLTag(location, text, tag)

  -- Obtain the HTML element opening and closing tag
  local openingTag, closingTag = generateHTMLElement(tag)

  -- Insert the file into the document using the correct opening and closing tags
  quarto.doc.include_text(location, openingTag .. text .. closingTag)

end

local function includeFileInHTMLTag(location, file, tag)

  -- Obtain the HTML element opening and closing tag
  local openingTag, closingTag = generateHTMLElement(tag)

  -- Retrieve the file contents
  local fileContents = readTemplateFile(file)

  -- Insert the file into the document using the correct opening and closing tags
  quarto.doc.include_text(location, openingTag .. fileContents .. closingTag)

end

-- Setup WebR's pre-requisites once per document.
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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  ]])

  -- Insert the extension styling for defined elements
  includeFileInHTMLTag("in-header", "qwebr-styling.css", "css")

  -- Insert the customized startup procedure
  includeTextInHTMLTag("in-header", initializationWebRDocumentSettings(), "js")

  -- Insert JS routine to add document status header
  includeFileInHTMLTag("in-header", "qwebr-document-status.js", "js")

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

  -- Insert the extension styling for defined elements
  includeFileInHTMLTag("before-body", "qwebr-monaco-editor-element.js", "js")

  -- If the ChannelType requires service workers, register and copy them into the 
  -- output directory.
  if hasServiceWorkerFiles then 
    -- Copy the two web workers into the directory
    -- https://quarto.org/docs/extensions/lua-api.html#dependencies
    quarto.doc.add_html_dependency({
      name = "webr-worker",
      version = baseVersionWebR,
      seviceworkers = {"webr-worker.js"}, -- Kept to avoid error text.
      serviceworkers = {"webr-worker.js"}
    })

    quarto.doc.add_html_dependency({
      name = "webr-serviceworker",
      version = baseVersionWebR,
      seviceworkers = {"webr-serviceworker.js"}, -- Kept to avoid error text.
      serviceworkers = {"webr-serviceworker.js"}
    })
  end

end

local function qwebrJSCellInsertionCode(counter)
  local insertionLocation = '<div id="qwebr-insertion-location-' .. counter ..'"></div>\n'
  local noscriptWarning = '<noscript>Please enable JavaScript to experience the dynamic code cell content on this page.</noscript>'
  return insertionLocation .. noscriptWarning
end 

-- Remove lines with only whitespace until the first non-whitespace character is detected.
local function removeEmptyLinesUntilContent(codeText)
  -- Iterate through each line in the codeText table
  for _, value in ipairs(codeText) do
      -- Detect leading whitespace (newline, return character, or empty space)
      local detectedWhitespace = string.match(value, "^%s*$")

      -- Check if the detectedWhitespace is either an empty string or nil
      -- This indicates whitespace was detected
      if isVariableEmpty(detectedWhitespace) then
          -- Delete empty space
          table.remove(codeText, 1)
      else
          -- Stop the loop as we've now have content
          break
      end
  end

  -- Return the modified table
  return codeText
end

-- Extract Quarto code cell options from the block's text
local function extractCodeBlockOptions(block)
  
  -- Access the text aspect of the code block
  local code = block.text

  -- Define two local tables:
  --  the block's attributes
  --  the block's code lines
  local cellOptions = {}
  local newCodeLines = {}

  -- Iterate over each line in the code block 
  for line in code:gmatch("([^\r\n]*)[\r\n]?") do
    -- Check if the line starts with "#|" and extract the key-value pairing
    -- e.g. #| key: value goes to cellOptions[key] -> value
    local key, value = line:match("^#|%s*(.-):%s*(.-)%s*$")

    -- If a special comment is found, then add the key-value pairing to the cellOptions table
    if key and value then
      cellOptions[key] = value
    else
      -- Otherwise, it's not a special comment, keep the code line
      table.insert(newCodeLines, line)
    end
  end

  -- Merge cell options with default options
  cellOptions = mergeCellOptions(cellOptions)

  -- Set the codeblock text to exclude the special comments.
  cellCode = table.concat(newCodeLines, '\n')

  -- Return the code alongside options
  return cellCode, cellOptions
end

-- Replace the code cell with a webR editor
local function enableWebRCodeCell(el)
      
  -- Let's see what's going on here:
  -- quarto.log.output(el)
  
  -- Should display the following elements:
  -- https://pandoc.org/lua-filters.html#type-codeblock
  
  -- Verify the element has attributes and the document type is HTML
  -- not sure if this will work with an epub (may need html:js)
  if not (el.attr and (quarto.doc.is_format("html") or quarto.doc.is_format("markdown"))) then
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

  -- Local code cell storage
  local cellOptions = {}
  local cellCode = ''

  -- Convert webr-specific option commands into attributes
  cellCode, cellOptions = extractCodeBlockOptions(el)

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

  -- Remove space left between options and code contents
  cellCode = removeEmptyLinesUntilContent(cellCode)

  -- Create a new table for the CodeBlock
  local codeBlockData = {
    id = qwebrCounter,
    code = cellCode,
    options = cellOptions
  }

  -- Store the CodeDiv in the global table
  table.insert(qwebrCapturedCodeBlocks, codeBlockData)

  -- Return an insertion point inside the document
  return pandoc.RawInline('html', qwebrJSCellInsertionCode(qwebrCounter))
end

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

