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
      
      -- Ensure that the {webr} tag is present and the document type is HTML
      -- not sure if this will work with an epub (may need html:js)
      -- Right now, we're using `{webr}` if engine is jupyter and `webr` if engine is `knitr` since the later dislikes custom engines
      if el.attr and (el.attr.classes:includes("{webr}") or el.attr.classes:includes("webr")) and quarto.doc.is_format("html") then
        
        -- Make sure we've initialized the code block
        ensureWebRSetup()

        -- Modify the counter variable each time this is run to create
        -- unique code cells
        counter = counter + 1
        
        -- 7 is the default height and width for knitr.
        -- Should we check the attributes for this value? Seems odd.
        -- https://yihui.org/knitr/options/
        local substitutions = {
          ["WEBRCOUNTER"] = counter, 
          ["WIDTH"] = 7,
          ["HEIGHT"] = 7,
          ["WEBRCODE"] = el.text
        }
        
        -- Make sure we perform a copy
        local copied_editor_template = editor_template

        -- Make the necessary substitutions
        local webr_enabled_code_cell = substitute_in_file(copied_editor_template, substitutions)

        -- Return the modified HTML template as a raw cell
        return pandoc.RawInline('html', webr_enabled_code_cell)
      end
      
      -- Allow for a pass through in other languages
      return el
    end
  }
}

