// Determine if we need to install R packages
globalThis.qwebrInstallRPackagesList = [{{INSTALLRPACKAGESLIST}}];

// Check to see if we have an empty array, if we do set to skip the installation.
globalThis.qwebrSetupRPackages = !(qwebrInstallRPackagesList.indexOf("") !== -1);
globalThis.qwebrAutoloadRPackages = {{AUTOLOADRPACKAGES}};

// Display a startup message?
globalThis.qwebrShowStartupMessage = {{SHOWSTARTUPMESSAGE}};
globalThis.qwebrShowHeaderMessage = {{SHOWHEADERMESSAGE}};

// Describe the webR settings that should be used
globalThis.qwebrCustomizedWebROptions = {
  "baseURL": "{{BASEURL}}",
  "serviceWorkerUrl": "{{SERVICEWORKERURL}}",
  "homedir": "{{HOMEDIR}}", 
  "channelType": "{{CHANNELTYPE}}"
};
