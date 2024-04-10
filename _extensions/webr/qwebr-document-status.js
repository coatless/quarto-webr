// Declare startupMessageQWebR globally
globalThis.qwebrStartupMessage = document.createElement("p");

// Verify if OffScreenCanvas is supported
globalThis.qwebrOffScreenCanvasSupport = function() {
  return typeof OffscreenCanvas !== 'undefined'
}

// Function to set the button text
globalThis.qwebrSetInteractiveButtonState = function(buttonText, enableCodeButton = true) {
  document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
    btn.innerHTML = buttonText;
    btn.disabled = !enableCodeButton;
  });
}

// Function to update the status message in non-interactive cells
globalThis.qwebrUpdateStatusMessage = function(message) {
  document.querySelectorAll(".qwebr-status-text.qwebr-cell-needs-evaluation").forEach((elem) => {
    elem.innerText = message;
  });
}

// Function to update the status message
globalThis.qwebrUpdateStatusHeader = function(message) {
  qwebrStartupMessage.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin qwebr-icon-status-spinner"></i>
    <span>${message}</span>`;
}

function qwebrPlaceMessageContents(content, html_location = "title-block-header", revealjs_location = "title-slide") {

  // Get references to header elements
  const headerHTML = document.getElementById(html_location);
  const headerRevealJS = document.getElementById(revealjs_location);

  // Determine where to insert the quartoTitleMeta element
  if (headerHTML || headerRevealJS) {
    // Append to the existing "title-block-header" element or "title-slide" div
    (headerHTML || headerRevealJS).appendChild(content);
  } else {
    // If neither headerHTML nor headerRevealJS is found, insert after "webr-monaco-editor-init" script
    const monacoScript = document.getElementById("qwebr-monaco-editor-init");
    const header = document.createElement("header");
    header.setAttribute("id", "title-block-header");
    header.appendChild(content);
    monacoScript.after(header);
  }
}


function qwebrOffScreenCanvasSupportWarningMessage() {
  
  // Verify canvas is supported.
  if(qwebrOffScreenCanvasSupport()) return;

  // Create the main container div
  var calloutContainer = document.createElement('div');
  calloutContainer.classList.add('callout', 'callout-style-default', 'callout-warning', 'callout-titled');

  // Create the header div
  var headerDiv = document.createElement('div');
  headerDiv.classList.add('callout-header', 'd-flex', 'align-content-center');

  // Create the icon container div
  var iconContainer = document.createElement('div');
  iconContainer.classList.add('callout-icon-container');

  // Create the icon element
  var iconElement = document.createElement('i');
  iconElement.classList.add('callout-icon');

  // Append the icon element to the icon container
  iconContainer.appendChild(iconElement);

  // Create the title container div
  var titleContainer = document.createElement('div');
  titleContainer.classList.add('callout-title-container', 'flex-fill');
  titleContainer.innerText = 'Warning: Web Browser Does Not Support Graphing!';

  // Append the icon container and title container to the header div
  headerDiv.appendChild(iconContainer);
  headerDiv.appendChild(titleContainer);

  // Create the body container div
  var bodyContainer = document.createElement('div');
  bodyContainer.classList.add('callout-body-container', 'callout-body');

  // Create the paragraph element for the body content
  var paragraphElement = document.createElement('p');
  paragraphElement.innerHTML = 'This web browser does not have support for displaying graphs through the <code>quarto-webr</code> extension since it lacks an <code>OffScreenCanvas</code>. Please upgrade your web browser to one that supports <code>OffScreenCanvas</code>.';

  // Append the paragraph element to the body container
  bodyContainer.appendChild(paragraphElement);

  // Append the header div and body container to the main container div
  calloutContainer.appendChild(headerDiv);
  calloutContainer.appendChild(bodyContainer);

  // Append the main container div to the document depending on format
  qwebrPlaceMessageContents(calloutContainer, "title-block-header"); 

}


// Function that attaches the document status message and diagnostics
function displayStartupMessage(showStartupMessage, showHeaderMessage) {
  if (!showStartupMessage) {
    return;
  }

  // Create the outermost div element for metadata
  const quartoTitleMeta = document.createElement("div");
  quartoTitleMeta.classList.add("quarto-title-meta");

  // Create the first inner div element
  const firstInnerDiv = document.createElement("div");
  firstInnerDiv.setAttribute("id", "qwebr-status-message-area");

  // Create the second inner div element for "WebR Status" heading and contents
  const secondInnerDiv = document.createElement("div");
  secondInnerDiv.setAttribute("id", "qwebr-status-message-title");
  secondInnerDiv.classList.add("quarto-title-meta-heading");
  secondInnerDiv.innerText = "WebR Status";

  // Create another inner div for contents
  const secondInnerDivContents = document.createElement("div");
  secondInnerDivContents.setAttribute("id", "qwebr-status-message-body");
  secondInnerDivContents.classList.add("quarto-title-meta-contents");

  // Describe the WebR state
  qwebrStartupMessage.innerText = "🟡 Loading...";
  qwebrStartupMessage.setAttribute("id", "qwebr-status-message-text");
  // Add `aria-live` to auto-announce the startup status to screen readers
  qwebrStartupMessage.setAttribute("aria-live", "assertive");

  // Append the startup message to the contents
  secondInnerDivContents.appendChild(qwebrStartupMessage);

  // Add a status indicator for COOP and COEP Headers if needed
  if (showHeaderMessage) {
    const crossOriginMessage = document.createElement("p");
    crossOriginMessage.innerText = `${crossOriginIsolated ? '🟢' : '🟡'} COOP & COEP Headers`;
    crossOriginMessage.setAttribute("id", "qwebr-coop-coep-header");
    secondInnerDivContents.appendChild(crossOriginMessage);
  }

  // Combine the inner divs and contents
  firstInnerDiv.appendChild(secondInnerDiv);
  firstInnerDiv.appendChild(secondInnerDivContents);
  quartoTitleMeta.appendChild(firstInnerDiv);

  // Place message on webpage
  qwebrPlaceMessageContents(quartoTitleMeta); 
}

displayStartupMessage(qwebrShowStartupMessage, qwebrShowHeaderMessage);
qwebrOffScreenCanvasSupportWarningMessage();