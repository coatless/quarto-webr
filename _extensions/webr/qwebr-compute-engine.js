// Function to verify a given JavaScript Object is empty
globalThis.qwebrIsObjectEmpty = function (arr) {
    return Object.keys(arr).length === 0;
}

// Global version of the Escape HTML function that converts HTML 
// characters to their HTML entities.
globalThis.qwebrEscapeHTMLCharacters = function(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

// Passthrough results
globalThis.qwebrIdentity = function(x) {
    return x;
};

// Append a comment
globalThis.qwebrPrefixComment = function(x, comment) {
    return `${comment}${x}`;
};

// Function to parse the pager results
globalThis.qwebrParseTypePager = async function (msg) { 

    // Split out the event data
    const { path, title, deleteFile } = msg.data; 

    // Process the pager data by reading the information from disk
    const paged_data = await mainWebR.FS.readFile(path).then((data) => {
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
        await mainWebR.FS.unlink(path); 
    } 

    // Return extracted data with spaces
    return paged_data;
} 

// Function to run the code using webR and parse the output
globalThis.qwebrComputeEngine = async function(
    codeToRun, 
    elements, 
    options) {

    // Call into the R compute engine that persists within the document scope.
    // To be prepared for all scenarios, the following happens: 
    // 1. We setup a canvas device to write to by making a namespace call into the {webr} package
    // 2. We use values inside of the options array to set the figure size.
    // 3. We capture the output stream information (STDOUT and STERR)
    // 4. While parsing the results, we disable image creation.

    // Create a canvas variable for graphics
    let canvas = undefined;

    // Create a pager variable for help/file contents
    let pager = [];

    // Handle how output is processed
    let showMarkup = options.results === "markup" && options.output !== "asis";
    let processOutput;

    if (showMarkup) {
        processOutput = qwebrEscapeHTMLCharacters;
    } else {
        processOutput = qwebrIdentity;
    }

    // ---- 
    // Convert from Inches to Pixels by using DPI (dots per inch)
    // for bitmap devices (dpi * inches = pixels)
    let fig_width = options["fig-width"] * options["dpi"]
    let fig_height = options["fig-height"] * options["dpi"]

    // Initialize webR
    await mainWebR.init();

    // Setup a webR canvas by making a namespace call into the {webr} package
    await mainWebR.evalRVoid(`webr::canvas(width=${fig_width}, height=${fig_height})`);

    const result = await mainWebRCodeShelter.captureR(codeToRun, {
        withAutoprint: true,
        captureStreams: true,
        captureConditions: false//,
        // env: webR.objs.emptyEnv, // maintain a global environment for webR v0.2.0
    });

    // -----

    // Start attempting to parse the result data
    processResultOutput:try {

        // Stop creating images
        await mainWebR.evalRVoid("dev.off()");
        
        // Avoid running through output processing
        if (options.results === "hide" || options.output === "false") { 
            break processResultOutput; 
        }

        // Merge output streams of STDOUT and STDErr (messages and errors are combined.)
        // Require both `warning` and `message` to be true to display `STDErr`. 
        const out = result.output
        .filter(
            evt => evt.type === "stdout" || 
            ( evt.type === "stderr" && (options.warning === "true" && options.message === "true")) 
        )
        .map((evt, index) => {
            const className = `qwebr-output-code-${evt.type}`;
            const outputResult = qwebrPrefixComment(processOutput(evt.data), options.comment);
            return `<code id="${className}-editor-${elements.id}-result-${index + 1}" class="${className}">${outputResult}</code>`;
        })
        .join("\n");


        // Clean the state
        // We're now able to process both graphics and pager events.
        // As a result, we cannot maintain a true 1-to-1 output order 
        // without individually feeding each line
        const msgs = await mainWebR.flush();

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
                canvas.setAttribute("width", 2 * fig_width);
                canvas.setAttribute("height", 2 * fig_height);
                canvas.style.width = options["out-width"] ? options["out-width"] : `${fig_width}px`;
                if (options["out-height"]) {
                    canvas.style.height = options["out-height"];
                }
                canvas.style.display = "block";
                canvas.style.margin = "auto";
            }
        } 
        });

        // Use `map` to process the filtered "pager" events asynchronously
        const pager = await Promise.all(
            msgs.filter(msg => msg.type === 'pager').map(
                async (msg) => {
                    return await qwebrParseTypePager(msg);
                }
            )
        );

        // Nullify the output area of content
        elements.outputCodeDiv.innerHTML = "";
        elements.outputGraphDiv.innerHTML = "";

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

        elements.outputCodeDiv.appendChild(pre);

        // Place the graphics on the canvas
        if (canvas) {
            // Create figure element
            const figureElement = document.createElement('figure');

            // Append canvas to figure
            figureElement.appendChild(canvas);

            if (options['fig-cap']) {
                // Create figcaption element
                const figcaptionElement = document.createElement('figcaption');
                figcaptionElement.innerText = options['fig-cap'];
                // Append figcaption to figure
                figureElement.appendChild(figcaptionElement);    
            }

            elements.outputGraphDiv.appendChild(figureElement);
        }

        // Display the pager data
        if (pager) {
        // Use the `pre` element to preserve whitespace.
        pager.forEach((paged_data, index) => {
            let pre_pager = document.createElement("pre");
            pre_pager.innerText = paged_data;
            pre_pager.classList.add("qwebr-output-code-pager");
            pre_pager.setAttribute("id", `qwebr-output-code-pager-editor-${elements.id}-result-${index + 1}`);
            elements.outputCodeDiv.appendChild(pre_pager);
        });
        }
    } finally {
        // Clean up the remaining code
        mainWebRCodeShelter.purge();
    }
}

// Function to execute the code (accepts code as an argument)
globalThis.qwebrExecuteCode = async function (
    codeToRun,
    id,
    options = {}) {

    // If options are not passed, we fall back on the bare minimum to handle the computation
    if (qwebrIsObjectEmpty(options)) {
        options = { 
            "context": "interactive", 
            "fig-width": 7, "fig-height": 5, 
            "out-width": "700px", "out-height": "", 
            "dpi": 72,
            "results": "markup", 
            "warning": "true", "message": "true",
        };
    }

    // Next, we access the compute areas values
    const elements = {
        runButton: document.getElementById(`qwebr-button-run-${id}`),
        outputCodeDiv: document.getElementById(`qwebr-output-code-area-${id}`),
        outputGraphDiv: document.getElementById(`qwebr-output-graph-area-${id}`),
        id: id,
    }

    // Disallowing execution of other code cells
    document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
        btn.disabled = true;
    });

    if (options.context == EvalTypes.Interactive) {
        // Emphasize the active code cell
        elements.runButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin qwebr-icon-status-spinner"></i> <span>Run Code</span>';
    }

    // Evaluate the code and parse the output into the document
    await qwebrComputeEngine(codeToRun, elements, options);

    // Switch to allowing execution of code
    document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
        btn.disabled = false;
    });

    if (options.context == EvalTypes.Interactive) {
        // Revert to the initial code cell state
        elements.runButton.innerHTML = '<i class="fa-solid fa-play qwebr-icon-run-code"></i> <span>Run Code</span>';
    }
}
