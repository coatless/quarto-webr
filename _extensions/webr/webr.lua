local hasDoneWebRSetup = false

-- Setup WebR's pre-requisites once per document.
function ensureShinyliveSetup()
  if hasDoneWebRSetup then
    return
  end
  hasDoneWebRSetup = true
  
  -- Insert the web initialization
  -- https://quarto.org/docs/extensions/lua-api.html#includes
  quarto.doc.include_file("in-header", "partials/webr-init.html")
end
