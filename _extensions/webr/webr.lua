----
--- Setup variables for default initialization

-- Define a variable to only include the initialization once
local hasDoneWebRSetup = false

--- Setup default initialization values
-- Default values taken from:
-- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html

-- Define a base compatibile version
local baseVersionWebR = "0.1.1"

-- Define where WebR can be found
local baseUrl = ""
local serviceWorkerUrl = ""

-- Define user directory
local homeDir = "/home/web_user"

-- Define whether a startup message should be displayed
local showStartUpMessage = "true"

-- Define whether header type messages should be displayed
local showHeaderMessage = "false"

-- Define an empty string if no packages need to be installed.
local installRPackagesList = "''"
----

--- Setup variables for tracking number of code cells

-- Define a counter variable
local counter = 0

----
--- Process initialization

-- Check if variable is present and not just the empty string
function is_variable_empty(s)
  return s == nil or s == ''
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
  if is_variable_empty(webr) then
    return meta
  end

  -- The base URL used for downloading R WebAssembly binaries 
  -- https://webr.r-wasm.org/[version]/webr.mjs
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#baseurl
  if not is_variable_empty(webr["base-url"]) then
    baseUrl = pandoc.utils.stringify(webr["base-url"])
  end

  -- The base URL from where to load JavaScript worker scripts when loading webR
  -- with the ServiceWorker communication channel mode.
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#serviceworkerurl
  if not is_variable_empty(webr["service-worker-url"]) then
    serviceWorkerUrl = pandoc.utils.stringify(webr["service-worker-url"])
  end

  -- The WebAssembly user's home directory and initial working directory. Default: '/home/web_user'
  -- Documentation:
  -- https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#homedir
  if not is_variable_empty(webr['home-dir']) then
    homeDir = pandoc.utils.stringify(webr["home-dir"])
  end

  -- Display a startup message indicating the WebR state at the top of the document.
  if not is_variable_empty(webr['show-startup-message']) then
    showStartUpMessage = pandoc.utils.stringify(webr["show-startup-message"])
  end

  -- Display a startup message indicating the WebR state at the top of the document.
  if not is_variable_empty(webr['show-header-message']) then
    showHeaderMessage = pandoc.utils.stringify(webr["show-header-message"])
    if showHeaderMessage == "true" then
      showStartUpMessage = "true"
    end
  end


  -- Attempt to install different packages.
  if not is_variable_empty(webr["packages"]) then
    -- Create a custom list
    local package_list = {}

    -- Iterate through each list item and enclose it in quotes
    for _, package_name in pairs(webr["packages"]) do
      table.insert(package_list, "'" .. pandoc.utils.stringify(package_name) .. "'")
    end

    installRPackagesList = table.concat(package_list, ", ")
  end

  
  return meta
end


-- Obtain a template file
function readTemplateFile(template)
  -- Establish a hardcoded path to where the .html partial resides
  -- Note, this should be at the same level as the lua filter.
  -- This is crazy fragile since Lua lacks a directory representation (!?!?)
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  local path = quarto.utils.resolve_path(template) 

  -- Let's hopefully read the template file... 

  -- Open the webr editor
  local file = io.open(path, "r")

  -- Check if null pointer before grabbing content
  if not file then
    return nil
  end

  -- *a or *all reads the whole file
  local content = file:read "*a" 

  -- Close the file
  file:close()

  -- Return contents
  return content
end

-- Obtain the editor template file at webr-editor.html
function editorTemplateFile()
  return readTemplateFile("webr-editor.html")
end

-- Obtain the initialization template file at webr-init.html
function initializationTemplateFile()
  return readTemplateFile("webr-init.html")
end

-- Cache a copy of the template to avoid multiple read/writes.
editor_template = editorTemplateFile()
----

-- Define a function that escape control sequence
function escapeControlSequences(str)
  -- Perform a global replacement on the control sequence character
  return str:gsub("[\\%c]", function(c)
    if c == "\\" then
      -- Escape backslash
      return "\\\\"
    end
  end)
end

-- Check if version is latest
function isLatestVersion(str)
  return str == "latest"
end


-- Verify the string is a valid version
function isMajorMinorPatchFormat(version)
  -- Create a regular expression pattern that matches:
  -- major.minor.patch
  local pattern = "^%d+%.%d+%.%d+$"

  -- If the pattern matches, then we're set!
  return string.match(version, pattern) ~= nil
end

function checkMajorMinorPatchVersionFormat(version_string)
  -- Verify string matches a given format
  if not isMajorMinorPatchFormat(version_string) then
      error("Invalid version string: " .. version_string)
  end
  -- Empty return to use as enforcement
  return 
end

-- Compare versions
function compareMajorMinorPatchVersions(v1, v2)

  -- Enforce a version string
  checkMajorMinorPatchVersionFormat(v1)
  checkMajorMinorPatchVersionFormat(v2)

  -- Extract version details
  local v1_major, v1_minor, v1_patch = v1:match("(%d+)%.(%d+)%.(%d+)")
  local v2_major, v2_minor, v2_patch = v2:match("(%d+)%.(%d+)%.(%d+)")
  
  -- Perform a comparison check on the dot releases, such that:
  -- v1 > v2 returns 1 
  -- v2 > v1 returns -1 
  -- v1 == v2 returns 0
  if tonumber(v1_major) > tonumber(v2_major) then
    return 1
  elseif tonumber(v2_major) > tonumber(v1_major) then
    return -1
  elseif tonumber(v1_minor) > tonumber(v2_minor) then
    return 1
  elseif tonumber(v2_minor) > tonumber(v1_minor) then
    return -1
  elseif tonumber(v1_patch) > tonumber(v2_patch) then
    return 1
  elseif tonumber(v2_patch) > tonumber(v1_patch) then
    return -1
  else
    return 0
  end
end
----

function initializationWebR()

  -- Setup different WebR specific initialization variables
  local substitutions = {
    ["SHOWSTARTUPMESSAGE"] = showStartUpMessage, -- tostring()
    ["SHOWHEADERMESSAGE"] = showHeaderMessage,
    ["BASEURL"] = baseUrl, 
    ["SERVICEWORKERURL"] = serviceWorkerUrl, 
    ["HOMEDIR"] = homeDir,
    ["INSTALLRPACKAGESLIST"] = installRPackagesList
    -- ["VERSION"] = baseVersionWebR
  }
  
  -- Make sure we perform a copy
  local initializationTemplate = initializationTemplateFile()

  -- Make the necessary substitutions
  local initializedWebRConfiguration = substitute_in_file(initializationTemplate, substitutions)

  return initializedWebRConfiguration
end

-- Setup WebR's pre-requisites once per document.
function ensureWebRSetup()
  
  -- If we've included the initialization, then bail.
  if hasDoneWebRSetup then
    return
  end
  
  -- Otherwise, let's include the initialization script _once_
  hasDoneWebRSetup = true

  local initializedConfigurationWebR = initializationWebR()
  
  -- Insert the web initialization
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  quarto.doc.include_text("in-header", initializedConfigurationWebR)

  -- Copy the two web workers into the directory
  -- https://quarto.org/docs/extensions/lua-api.html#dependencies
  quarto.doc.add_format_resource("webr-worker.js")	
  quarto.doc.add_format_resource("webr-serviceworker.js")	
end

-- Define a function to replace keywords given by {{ WORD }}
-- Is there a better lua-approach?
function substitute_in_file(contents, substitutions)

  -- Substitute values in the contents of the file
  contents = contents:gsub("{{%s*(.-)%s*}}", substitutions)

  -- Return the contents of the file with substitutions
  return contents
end

function enableWebRCodeCell(el)
      
  -- Let's see what's going on here:
  -- quarto.log.output(el)
  
  -- Should display the following elements:
  -- https://pandoc.org/lua-filters.html#type-codeblock
  
  -- Verify the element has attributes and the document type is HTML
  -- not sure if this will work with an epub (may need html:js)
  if el.attr and quarto.doc.is_format("html") then

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
    
    if (originalEngine or newEngine) then
      
      -- Make sure we've initialized the code block
      ensureWebRSetup()

      -- Modify the counter variable each time this is run to create
      -- unique code cells
      counter = counter + 1
      
      -- 7 is the default height and width for knitr. But, that doesn't translate to pixels.
      -- So, we have 504 and 360 respectively.
      -- Should we check the attributes for this value? Seems odd.
      -- https://yihui.org/knitr/options/
      local substitutions = {
        ["WEBRCOUNTER"] = counter, 
        ["WIDTH"] = 504,
        ["HEIGHT"] = 360,
        ["WEBRCODE"] = escapeControlSequences(el.text)
      }
      
      -- Make sure we perform a copy
      local copied_editor_template = editor_template

      -- Make the necessary substitutions
      local webr_enabled_code_cell = substitute_in_file(copied_editor_template, substitutions)

      -- Return the modified HTML template as a raw cell
      return pandoc.RawInline('html', webr_enabled_code_cell)
    end
  end
  -- Allow for a pass through in other languages
  return el
end

return {
  {
    Meta = setWebRInitializationOptions
  }, 
  {
    CodeBlock = enableWebRCodeCell
  }
}

