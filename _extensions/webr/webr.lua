-- Define a variable to only include the initialization once
local hasDoneWebRSetup = false
-- Define a counter variable
local counter = 0

----
-- Read in the template

-- Open the webr editor
local editor_file = io.open("partials/webr-editor.html", "r")
-- Read the contents of the file
local editor_template = editor_file:read("*all")
-- Close the file
editor_file:close()

----

-- Setup WebR's pre-requisites once per document.
function ensureWebRSetup()
  
  -- If we've included the initialization, then bail.
  if hasDoneWebRSetup then
    return
  end
  
  -- Otherwise, let's include the initialization script.
  hasDoneWebRSetup = true
  
  -- Insert the web initialization
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  quarto.doc.include_file("in-header", "partials/webr-init.html")
end

-- Define a function to replace keywords given by {{ WORD }}
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
      quarto.log.output(el)
      
      -- Should display the following elements:
      -- https://pandoc.org/lua-filters.html#type-codeblock
      
      if el.attr and el.attr.classes:includes("{webr}") and quarto.doc.is_format("html") then
        
        -- Make sure we've initialized the code block
        ensureWebRSetup()

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
        
        local webr_enabled_code_cell = substitute_in_file(copied_editor_template, substitutions)

        return pandoc.RawInline('html', webr_enabled_code_cell)
      end
      
      -- Allow for a pass through in other languages
      return el
    end
  }
}

