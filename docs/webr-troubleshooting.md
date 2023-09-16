---
title: "Troubleshooting quarto-webr hiccups"
---

As this is an exciting new frontier, we're learning as we go. Or as my friend [Lawrence](https://cs.illinois.edu/about/people/faculty/angrave) says, ["I like to build airplanes in the air-"](https://www.youtube.com/watch?v=L2zqTYgcpfg). Please take note of the following issues:

# Stuck at Loading webR...

If `webr-worker.js` or `webr-serviceworker.js` are not found when the document loads either at the root `/` or relative directory, then `Loading webR...` will appear above the code cell instead of `Run code`. Please make sure the files are at the same location as the quarto document. For example, the following structure will work:

```
.
├── demo-quarto-webr.qmd
├── webr-serviceworker.js
└── webr-worker.js
```

Still having trouble? Try specifying where the worker files are located using the `service-worker-url` option in the document's YAML header.

# Directly accessing rendered HTML

When using  `quarto preview` or `quarto render`, the rendered HTML document is being shown by mimicking a server running under `https://localhost/`. Usually, everything works in this context assuming the above directory structure is followed. However, if you **directly** open the rendered HTML document, e.g. `demo-quarto-web.html`, inside of a Web Browser, then the required WebR components cannot be loaded for security reasons. You can read a bit more about the problem in this [StackOverflow answer](https://stackoverflow.com/questions/6811398/html5-web-workers-work-in-firefox-4-but-not-in-chrome-12-0-742-122/6823683#6823683).

There are a few possible solutions to avoid requiring quarto on a local computer to directly open the rendered file: 

- [Use Chrome's `--allow-file-access-from-files` access](https://stackoverflow.com/questions/18586921/how-to-launch-html-using-chrome-at-allow-file-access-from-files-mode)
- [Use the WebServer for Chrome extension](https://chrome.google.com/webstore/detail/web-server-for-chrome/ofhbbkphhbklhfoeikjpcbhemlocgigb?hl=en)
- Or, [use NPM to obtain `local-web-server`](https://github.com/lwsjs/local-web-server)

# Speed up webR

When serving webR documents, please try to ensure the [COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) and [COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy) HTTP headers are set to speed up the process:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

We describe how to setup this option in [`"shared-array-buffer"`](webr-channel-type.qmd) channel type documentation.

# Engine Registration

If using the `knitr` engine instead of the `jupyter` engine and you are using the original tag of `{webr}` instead of `{webr-r}`, 
there is a known warning that will appear in the render processing output of:

```r
Warning message:
In get_engine(options$engine) :
  Unknown language engine 'webr' (must be registered via knit_engines$set()).
```

This warning does not prevent or impact the ability of the `webr` filter to function. 
Though, we would like to address it at some point since it is not aesthetically pleasing.
