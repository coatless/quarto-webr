-- Define a variable to only include the initialization once
local hasDoneWebRSetup = false
-- Define a counter variable
local counter = 0
----

-- Read in the editor template
function editorTemplateFile()
  -- Establish a hardcoded path to where the webr-editor.html partial resides
  -- Note, this should be at the same level as the lua filter.
  -- This is crazy fragile since lua lacks a directory representation (!?!?)
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  local path = quarto.utils.resolve_path("webr-editor.html") 

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

----

-- Setup WebR's pre-requisites once per document.
function ensureWebRSetup()
  
  -- If we've included the initialization, then bail.
  if hasDoneWebRSetup then
    return
  end
  
  -- Otherwise, let's include the initialization script _once_
  hasDoneWebRSetup = true
  
  -- Insert the web initialization
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  quarto.doc.include_file("in-header", "webr-init.html")

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

return {
  {
    CodeBlock = function(el)
      
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
  }
}

