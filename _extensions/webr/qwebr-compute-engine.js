// Enum
globalThis.EvalTypes = Object.freeze({
    Interactive: 'interactive',
    Setup: 'setup',
    Output: 'output',
});


// Function to execute the code (accepts code as an argument)
  globalThis.qwebrExecuteCode = async function (
    codeToRun,
    id,
    evalType = EvalTypes.Interactive,
    options = {}) {

    // If options are not passed, we fall back on the bare minimum to handle the computation
    if (!options) {
        options = { "fig-width": 504, "fig-height": 360 };
    }

    // Next, we access the compute areas values
    const runButton = document.getElementById(`qwebr-button-run-${id}`);
    const outputCodeDiv = document.getElementById(`qwebr-output-code-area-${id}`);
    const outputGraphDiv = document.getElementById(`qwebr-output-graph-area-${id}`);
    // const editorDiv = document.getElementById(`qwebr-editor-${id}`);
    
    // Disallowing execution of other code cells
    document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
      btn.disabled = true;
    });

    if (evalType == EvalTypes.Interactive) {
        // Emphasize the active code cell
        runButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin qwebr-icon-status-spinner"></i> <span>Run Code</span>';
    }

    // Create a canvas variable for graphics
    let canvas = undefined;

    // Create a pager variable for help/file contents
    let pager = [];

    // Process 
    async function parseTypePager(msg) { 

        // Split out the event data
        const { path, title, deleteFile } = msg.data; 

        // Process the pager data by reading the information from disk
        const paged_data = await webR.FS.readFile(path).then((data) => {
          // Obtain the file content
          let content = new TextDecoder().decode(data);

          // Remove excessive backspace characters until none remain
          while(content.match(/.[\b]/)){
            content = content.replace(/.[\b]/g, '');
          }

          // Returned cleaned data
          return content;
        });

        // Unlink file if needed
        if (deleteFile) { 
          await webR.FS.unlink(path); 
        } 

        // Return extracted data with spaces
        return paged_data;
    } 

    // ---- 

    // Initialize webR
    await webR.init();

    // Call into the R compute engine that persists within the document scope.
    // To be prepared for all scenarios, the following happens: 
    // 1. We setup a canvas device to write to by making a namespace call into the {webr} package
    // 2. We use values inside of the options array to set the figure size.
    // 3. We capture the output stream information (STDOUT and STERR)
    // 4. Stop creating images.
    const result = await webRCodeShelter.captureR(`
    invisible(webr::canvas(width=${options["fig-width"]/2}, height=${options["fig-height"]/2}))
    ${codeToRun}
    invisible(dev.off())
    `, {
      withAutoprint: true,
      captureStreams: true,
      captureConditions: false//,
      // env: webR.objs.emptyEnv, // maintain a global environment for webR v0.2.0
    });

    // -----

    // Start attempting to parse the result data
    try {

      // Merge output streams of STDOUT and STDErr (messages and errors are combined.)
      const out = result.output
        .filter(evt => evt.type === "stdout" || evt.type === "stderr")
        .map((evt, index) => {
          const className = `qwebr-output-code-${evt.type}`;
          return `<code id="${className}-editor-${id}-result-${index + 1}" class="${className}">${qwebrEscapeHTMLCharacters(evt.data)}</code>`;
        })
        .join("\n");


      // Clean the state
      // We're now able to process both graphics and pager events.
      // As a result, we cannot maintain a true 1-to-1 output order 
      // without individually feeding each line
      const msgs = await webR.flush();

      // Output each image event stored
      msgs.forEach((msg) => {
        // Determine if old canvas can be used or a new canvas is required.
        if (msg.type === 'canvas'){
          // Add image to the current canvas
          if (msg.data.event === 'canvasImage') {
            canvas.getContext('2d').drawImage(msg.data.image, 0, 0);
          } else if (msg.data.event === 'canvasNewPage') {
            // Generate a new canvas element
            canvas = document.createElement("canvas");
            canvas.setAttribute("width", 2 * options["fig-width"]);
            canvas.setAttribute("height", 2 * options["fig-height"]);
            canvas.style.width = "700px";
            canvas.style.display = "block";
            canvas.style.margin = "auto";
          }
        } 
      });

      // Use `map` to process the filtered "pager" events asynchronously
      const pager = await Promise.all(
        msgs.filter(msg => msg.type === 'pager').map(
          async (msg) => {
            return await parseTypePager(msg);
          }
        )
      );

      // Nullify the output area of content
      outputCodeDiv.innerHTML = "";
      outputGraphDiv.innerHTML = "";

      // Design an output object for messages
      const pre = document.createElement("pre");
      if (/\S/.test(out)) {
        // Display results as HTML elements to retain output styling
        const div = document.createElement("div");
        div.innerHTML = out;
        pre.appendChild(div);
      } else {
        // If nothing is present, hide the element.
        pre.style.visibility = "hidden";
      }
      outputCodeDiv.appendChild(pre);

      // Place the graphics on the canvas
      if (canvas) {
        outputGraphDiv.appendChild(canvas);
      }

      // Display the pager data
      if (pager) {
        // Use the `pre` element to preserve whitespace.
        pager.forEach((paged_data, index) => {
          let pre_pager = document.createElement("pre");
          pre_pager.innerText = paged_data;
          pre_pager.classList.add("qwebr-output-code-pager");
          pre_pager.setAttribute("id", "qwebr-output-code-pager-editor-{{WEBRCOUNTER}}-result-" + (index + 1));
          outputCodeDiv.appendChild(pre_pager);
        });
      }
    } finally {
      // Clean up the remaining code
      webRCodeShelter.purge();
    }

    // Switch to allowing execution of code
    document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
      btn.disabled = false;
    });

    if (evalType == EvalTypes.Interactive) {
        // Revert to the initial code cell state
        runButton.innerHTML = '<i class="fa-solid fa-play qwebr-icon-run-code"></i> <span>Run Code</span>';
    }
  }
