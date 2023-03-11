-- Define a variable to only include the initialization once
local hasDoneWebRSetup = false
-- Define a counter variable
local counter = 0

-- Setup WebR's pre-requisites once per document.
function ensureShinyliveSetup()
  
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



