// Start a timer
const initializeWebRTimerStart = performance.now();

// Encase with a dynamic import statement
globalThis.qwebrInstance = import(qwebrCustomizedWebROptions.baseURL + "webr.mjs").then(
  async ({ WebR, ChannelType }) => {
    // Populate WebR options with defaults or new values based on `webr` meta
    globalThis.mainWebR = new WebR(qwebrCustomizedWebROptions);

    // Initialization WebR
    await mainWebR.init();

    // Setup a shelter
    globalThis.mainWebRCodeShelter = await new mainWebR.Shelter();

    // Setup a pager to allow processing help documentation 
    await mainWebR.evalRVoid('webr::pager_install()'); 

    // Check to see if any packages need to be installed
    if (qwebrSetupRPackages) {
      // Obtain only a unique list of packages
      const uniqueRPackageList = Array.from(new Set(qwebrInstallRPackagesList));

      // Install R packages one at a time (either silently or with a status update)
      await qwebrProcessRPackagesWithStatus(uniqueRPackageList, 'install', showStartupMessage);

      if (autoloadRPackages) {
        // Load R packages one at a time (either silently or with a status update)
        await qwebrProcessRPackagesWithStatus(uniqueRPackageList, 'load', showStartupMessage);
      }
    }
  }
);

// Stop timer
const initializeWebRTimerEnd = performance.now();

// Release document status as ready
if (qwebrShowStartupMessage) {
  qwebrInstance.then(
    () => {
      qwebrStartupMessage.innerText = "🟢 Ready!"
    }
  )
}

