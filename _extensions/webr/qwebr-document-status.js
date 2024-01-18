// Declare startupMessageQWebR globally
globalThis.qwebrStartupMessage = document.createElement("p");


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

// Function that attaches the document status message and diagnostics
function displayStartupMessage(showStartupMessage, showHeaderMessage) {
  if (!showStartupMessage) {
    return;
  }

  // Get references to header elements
  const headerHTML = document.getElementById("title-block-header");
  const headerRevealJS = document.getElementById("title-slide");

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

  // Determine where to insert the quartoTitleMeta element
  if (headerHTML || headerRevealJS) {
    // Append to the existing "title-block-header" element or "title-slide" div
    (headerHTML || headerRevealJS).appendChild(quartoTitleMeta);
  } else {
    // If neither headerHTML nor headerRevealJS is found, insert after "webr-monaco-editor-init" script
    const monacoScript = document.getElementById("qwebr-monaco-editor-init");
    const header = document.createElement("header");
    header.setAttribute("id", "title-block-header");
    header.appendChild(quartoTitleMeta);
    monacoScript.after(header);
  }
}

displayStartupMessage(qwebrShowStartupMessage, qwebrShowHeaderMessage);