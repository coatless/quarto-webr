// Start a timer
const initializeWebRTimerStart = performance.now();

// Determine if we need to install R packages
var installRPackagesList = [{{INSTALLRPACKAGESLIST}}];
// Check to see if we have an empty array, if we do set to skip the installation.
var setupRPackages = !(installRPackagesList.indexOf("") !== -1);
var autoloadRPackages = {{AUTOLOADRPACKAGES}};

// Display a startup message?
var showStartupMessage = {{SHOWSTARTUPMESSAGE}};
var showHeaderMessage = {{SHOWHEADERMESSAGE}};
if (showStartupMessage) {

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
  var startupMessageWebR = document.createElement("p");
  startupMessageWebR.innerText = "🟡 Loading...";
  startupMessageWebR.setAttribute("id", "qwebr-status-message-text");
  // Add `aria-live` to auto-announce the startup status to screen readers
  startupMessageWebR.setAttribute("aria-live", "assertive");

  // Append the startup message to the contents
  secondInnerDivContents.appendChild(startupMessageWebR);

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
  if (headerHTML) {
    // Append to the existing "title-block-header" element
    headerHTML.appendChild(quartoTitleMeta);
  } else if (headerRevealJS) {
    // If using RevealJS, add to the "title-slide" div
    headerRevealJS.appendChild(firstInnerDiv);
  } else {
    // If neither headerHTML nor headerRevealJS is found, insert after "webr-monaco-editor-init" script
    const monacoScript = document.getElementById("qwebr-monaco-editor-init");
    const header = document.createElement("header");
    header.setAttribute("id", "title-block-header");
    header.appendChild(quartoTitleMeta);
    monacoScript.after(header);
  }
}

// Retrieve the webr.mjs
import { WebR, ChannelType } from "{{BASEURL}}webr.mjs";

// Populate WebR options with defaults or new values based on 
// webr meta
globalThis.webR = new WebR({
  "baseURL": "{{BASEURL}}",
  "serviceWorkerUrl": "{{SERVICEWORKERURL}}",
  "homedir": "{{HOMEDIR}}", 
  "channelType": {{CHANNELTYPE}}
});

// Initialization WebR
await webR.init();

// Setup a shelter
globalThis.webRCodeShelter = await new webR.Shelter();

// Setup a pager to allow processing help documentation 
await webR.evalRVoid('webr::pager_install()'); 

// Function to set the button text
function qwebrSetInteractiveButtonState(buttonText, enableCodeButton = true) {
  document.querySelectorAll(".qwebr-button-run").forEach((btn) => {
    btn.innerHTML = buttonText;
    btn.disabled = !enableCodeButton;
  });
}

// Function to update the status message
function qwebrUpdateStatusHeader(message) {
  startupMessageWebR.innerHTML = `
    <i class="fa-solid fa-spinner fa-spin qwebr-icon-status-spinner"></i>
    <span>${message}</span>`;
}

// Function to install a single package
async function qwebrInstallRPackage(packageName) {
  await globalThis.webR.installPackages([packageName]);
}

// Function to load a single package
async function qwebrLoadRPackage(packageName) {
  await globalThis.webR.evalRVoid(`library(${packageName});`);
}

// Generic function to process R packages
async function qwebrProcessRPackagesWithStatus(packages, processType, displayStatusMessageUpdate = true) {
  // Switch between contexts
  const messagePrefix = processType === 'install' ? 'Installing' : 'Loading';

  // Modify button state
  qwebrSetInteractiveButtonState(`🟡 ${messagePrefix} package ...`, false);

  // Iterate over packages
  for (let i = 0; i < packages.length; i++) {
    const activePackage = packages[i];
    const formattedMessage = `${messagePrefix} package ${i + 1} out of ${packages.length}: ${activePackage}`;
    
    // Display the update
    if (displayStatusMessageUpdate) {
      qwebrUpdateStatusHeader(formattedMessage);
    }

    // Run package installation
    if (processType === 'install') {
      await qwebrInstallRPackage(activePackage);
    } else {
      await qwebrLoadRPackage(activePackage);
    }
  }

  // Clean slate
  if (processType === 'load') {
    await globalThis.webR.flush();
  }
}


// Check to see if any packages need to be installed
if (setupRPackages) {
  // Obtain only a unique list of packages
  const uniqueRPackageList = Array.from(new Set(installRPackagesList));

  // Install R packages one at a time (either silently or with a status update)
  await qwebrProcessRPackagesWithStatus(uniqueRPackageList, 'install', showStartupMessage);

  if(autoloadRPackages) {
    // Load R packages one at a time (either silently or with a status update)
    await qwebrProcessRPackagesWithStatus(uniqueRPackageList, 'load', showStartupMessage);
  }
}

// Stop timer
const initializeWebRTimerEnd = performance.now();

// Release document status as ready
if (showStartupMessage) {
  startupMessageWebR.innerText = "🟢 Ready!"
}

qwebrSetInteractiveButtonState(
  `<i class="fa-solid fa-play qwebr-icon-run-code"></i> <span>Run Code</span>`, 
  true
);

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