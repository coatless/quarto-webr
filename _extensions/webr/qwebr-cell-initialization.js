// Handle cell initialization initialization
qwebrCellDetails.map(
  (entry) => {
    // Handle the creation of the element
    qwebrCreateHTMLElement(entry);
    // In the event of interactive, initialize the monaco editor
    if (entry.options.context == EvalTypes.Interactive) {
      qwebrCreateMonacoEditorInstance(entry);
    }
  }
);

// Identify non-interactive cells (in order)
const filteredEntries = qwebrCellDetails.filter(entry => {
  const contextOption = entry.options && entry.options.context;
  return ['output', 'setup'].includes(contextOption);
});

// Condition non-interactive cells to only be run after webR finishes its initialization.
qwebrInstance.then(
  async () => {

    // Begin processing non-interactive sections
    filteredEntries.map( 
      async (entry) => {
        // Extract key components
        const evalType = entry.options.context;
        const cellCode = entry.code;
        const qwebrCounter = entry.id;
        switch (evalType) {
          case 'output':
            // Run the code in a non-interactive state that is geared to displaying output
            await qwebrExecuteCode(`${cellCode}`, qwebrCounter, EvalTypes.Output);
            break;
          case 'setup':
            // Run the code in a non-interactive state with all output thrown away
            await webR.evalRVoid(`${cellCode}`);
            break;
          default: 
            break; 
        }
      }
    )
  }
).then(
  () => {
    // Release document status as ready

    if (qwebrShowStartupMessage) {
      qwebrStartupMessage.innerText = "🟢 Ready!"
    }
  
    qwebrSetInteractiveButtonState(
      `<i class="fa-solid fa-play qwebr-icon-run-code"></i> <span>Run Code</span>`, 
      true
    );  
  }
);