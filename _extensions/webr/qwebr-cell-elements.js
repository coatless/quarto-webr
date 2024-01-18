// Supported Evaluation Types for Context
globalThis.EvalTypes = Object.freeze({
  Interactive: 'interactive',
  Setup: 'setup',
  Output: 'output',
});

// Function that dispatches the creation request
globalThis.qwebrCreateHTMLElement = function (
  cellData
) {

  // Extract key components
  const evalType = cellData.options.context;
  const qwebrCounter = cellData.id;

  // We make an assumption that insertion points are defined by the Lua filter as:
  // qwebr-insertion-location-{qwebrCounter} 
  const elementLocator = document.getElementById(`qwebr-insertion-location-${qwebrCounter}`);

  // Figure out the routine to use to insert the element.
  let qwebrElement;
  switch ( evalType ) {
    case EvalTypes.Interactive:
      qwebrElement = qwebrCreateInteractiveElement(qwebrCounter);
      break;
    case EvalTypes.Output: 
      qwebrElement = qwebrCreateNonInteractiveOutputElement(qwebrCounter);
      break;
    case EvalTypes.Setup: 
      qwebrElement = qwebrCreateNonInteractiveSetupElement(qwebrCounter);
      break;
    default: 
      qwebrElement = document.createElement('div');
      qwebrElement.textContent = 'Error creating `quarto-webr` element';
  }

  // Insert the dynamically generated object at the document location.
  elementLocator.appendChild(qwebrElement);
};

// Function that setups the interactive element creation
globalThis.qwebrCreateInteractiveElement = function (qwebrCounter) {

  // Create main div element
  var mainDiv = document.createElement('div');
  mainDiv.id = 'qwebr-interactive-area-' + qwebrCounter;
  mainDiv.className = 'qwebr-interactive-area';

  // Create button element
  var button = document.createElement('button');
  button.className = 'btn btn-default qwebr-button-run';
  button.disabled = true;
  button.type = 'button';
  button.id = 'qwebr-button-run-' + qwebrCounter;
  button.textContent = '🟡 Loading webR...';

  // Create console area div
  var consoleAreaDiv = document.createElement('div');
  consoleAreaDiv.id = 'qwebr-console-area-' + qwebrCounter;
  consoleAreaDiv.className = 'qwebr-console-area';

  // Create editor div
  var editorDiv = document.createElement('div');
  editorDiv.id = 'qwebr-editor-' + qwebrCounter;
  editorDiv.className = 'qwebr-editor';

  // Create output code area div
  var outputCodeAreaDiv = document.createElement('div');
  outputCodeAreaDiv.id = 'qwebr-output-code-area-' + qwebrCounter;
  outputCodeAreaDiv.className = 'qwebr-output-code-area';
  outputCodeAreaDiv.setAttribute('aria-live', 'assertive');

  // Create pre element inside output code area
  var preElement = document.createElement('pre');
  preElement.style.visibility = 'hidden';
  outputCodeAreaDiv.appendChild(preElement);

  // Create output graph area div
  var outputGraphAreaDiv = document.createElement('div');
  outputGraphAreaDiv.id = 'qwebr-output-graph-area-' + qwebrCounter;
  outputGraphAreaDiv.className = 'qwebr-output-graph-area';

  // Append all elements to the main div
  mainDiv.appendChild(button);
  consoleAreaDiv.appendChild(editorDiv);
  consoleAreaDiv.appendChild(outputCodeAreaDiv);
  mainDiv.appendChild(consoleAreaDiv);
  mainDiv.appendChild(outputGraphAreaDiv);

  return mainDiv;
}

// Function that adds output structure for non-interactive output
globalThis.qwebrCreateNonInteractiveOutputElement = function(qwebrCounter) {
  // Create main div element
  var mainDiv = document.createElement('div');
  mainDiv.id = 'qwebr-noninteractive-area-' + qwebrCounter;
  mainDiv.className = 'qwebr-noninteractive-area';

  // Create a status container div
  var statusContainer = createLoadingContainer(qwebrCounter);

  // Create output code area div
  var outputCodeAreaDiv = document.createElement('div');
  outputCodeAreaDiv.id = 'qwebr-output-code-area-' + qwebrCounter;
  outputCodeAreaDiv.className = 'qwebr-output-code-area';
  outputCodeAreaDiv.setAttribute('aria-live', 'assertive');

  // Create pre element inside output code area
  var preElement = document.createElement('pre');
  preElement.style.visibility = 'hidden';
  outputCodeAreaDiv.appendChild(preElement);

  // Create output graph area div
  var outputGraphAreaDiv = document.createElement('div');
  outputGraphAreaDiv.id = 'qwebr-output-graph-area-' + qwebrCounter;
  outputGraphAreaDiv.className = 'qwebr-output-graph-area';

  // Append all elements to the main div
  mainDiv.appendChild(statusContainer);
  mainDiv.appendChild(outputCodeAreaDiv);
  mainDiv.appendChild(outputGraphAreaDiv);

  return mainDiv;
};

// Function that adds a stub in the page to indicate a setup cell was used.
globalThis.qwebrCreateNonInteractiveSetupElement = function(qwebrCounter) {
  // Create main div element
  var mainDiv = document.createElement('div');
  mainDiv.id = `qwebr-noninteractive-setup-area-${qwebrCounter}`;
  mainDiv.className = 'qwebr-noninteractive-setup-area';

  // Create a status container div
  var statusContainer = createLoadingContainer(qwebrCounter);

  // Append status onto the main div
  mainDiv.appendChild(statusContainer);

  return mainDiv;
}


// Function to create loading container with specified ID
globalThis.createLoadingContainer = function(qwebrCounter) {

  // Create a status container
  const container = document.createElement('div');
  container.id = `qwebr-non-interactive-loading-container-${qwebrCounter}`;
  container.className = 'qwebr-non-interactive-loading-container qwebr-cell-needs-evaluation';

  // Create an R project logo to indicate its a code space
  const rProjectIcon = document.createElement('i');
  rProjectIcon.className = 'fa-brands fa-r-project fa-3x qwebr-r-project-logo';

  // Setup a loading icon from font awesome
  const spinnerIcon = document.createElement('i');
  spinnerIcon.className = 'fa-solid fa-spinner fa-spin fa-1x qwebr-icon-status-spinner';

  // Add a section for status text
  const statusText = document.createElement('p');
  statusText.id = `qwebr-status-text-${qwebrCounter}`;
  statusText.className = `qwebr-status-text qwebr-cell-needs-evaluation`;
  statusText.innerText = 'Loading webR...';

  // Incorporate an inner container
  const innerContainer = document.createElement('div');

  // Append elements to the inner container
  innerContainer.appendChild(spinnerIcon);
  innerContainer.appendChild(statusText);

  // Append elements to the main container
  container.appendChild(rProjectIcon);
  container.appendChild(innerContainer);

  return container;
}