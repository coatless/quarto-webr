# webR Code Extension for Quarto HTML Documents

This extension enables the [webR](https://docs.r-wasm.org/webr/latest/) code cell in a Quarto HTML document. 

![`quarto-webr` Filter in Action](https://i.imgur.com/NCTDwUk.gif)

The goal of [webR](https://docs.r-wasm.org/webr/latest/) is to: 

> run R code in the browser without the need for an R server to execute the code

For more details on [webR](https://docs.r-wasm.org/webr/latest/), please see: 

- [webR Documentation](https://docs.r-wasm.org/webr/latest/)
- [webR Source Code](https://github.com/r-wasm/webr/)

## Installation 

To use this extension in a Quarto project, install it from within the project's working directory by typing into **Terminal**:

``` bash
quarto add coatless/quarto-webr
```

![Demonstration of using the Terminal tab to install the extension.](https://i.imgur.com/aVuBdyN.png)

## Usage

For each document, place the `webr` filter in the document's header:

```yaml
filters:
  - webr
```

Then, place the R code for `webR` in a code block marked with `{webr-r}`

````markdown
---
title: webR in Quarto HTML Documents
format: html
engine: knitr
filters:
  - webr
---

This is a webr-enabled code cell in a Quarto HTML document.

```{webr-r}
fit = lm(mpg ~ am, data = mtcars)
summary(fit)
```
````


When `quarto render` or `quarto preview` is called, the filter will execute under `engine: knitr`. 
During the execution, the filter adds two files to the working directory: `webr-worker.js` and `webr-serviceworker.js`. These files allow for the 
`webR` session to be started and must be present with the rendered output. 

**Note:** If `engine: knitr` is not specified, then the `jupyter` compute engine will be used by default.

### Packages

By default, the `quarto-webr` extension avoids loading or requesting additional packages. Additional packages can be added 
when the document is first opened or on per-code cell basis. You can view what packages are available by either executing 
the following R code (either with WebR or just R):

```r
available.packages(repos="https://repo.r-wasm.org/", type="source")
```

Or, by navigating to the WebR repository:

<https://github.com/r-wasm/webr-repo/blob/main/repo-packages>


#### Install on document open

Add to the document header YAML the `packages` key under `webr` with each package listed using an array, e.g. 

```yaml
---
webr:
  packages: ['ggplot2', 'dplyr']
---
```

#### Install on an as needed basis

Packages may also be installed inside of a code cell through the built-in [`webr::install()` function](https://docs.r-wasm.org/webr/latest/packages.html#example-installing-the-matrix-package). For example, to install `ggplot2`, you would need to use: 

```r
webr::install("ggplot2")
```

### Customizing webR from the Quarto Extension

The `quarto-webr` extension supports specifying the following `WebROptions` options:

- `home-dir`: The WebAssembly user’s home directory and initial working directory ([`Documentation`](https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#homedir)). Default: `'/home/web_user'`.
- `base-url`: The base URL used for downloading R WebAssembly binaries ([`Documentation`](https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#baseurl)). Default: `'https://webr.r-wasm.org/[version]/'`.
- `channel-type`: The communication channel type to interact with webR ([`Documentation`](https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#channeltype)). Default: `"automatic"` (0). Alternative options are: `"shared-array-buffer"` (1), `"service-worker"` (2), `"post-message"` (3).
   - We recommend using `"post-message"` option if GitHub Pages or Quarto Pub are serving the webR-enabled document.
   - However, this option prevents the interruption of running _R_ code and prevents the use of nested R REPLs (`readline()`, `menu()`, `browser()`, etc.) 
- `service-worker-url`: The base URL from where to load JavaScript worker scripts when loading webR with the ServiceWorker communication channel mode ([`Documentation`](https://docs.r-wasm.org/webr/latest/api/js/interfaces/WebR.WebROptions.html#serviceworkerurl)). Default: `''`.

The extension also has native options for:

- `show-startup-message`: Display in the document header the state of WebR initialization. Default: `true`
- `show-header-message`: Display in the document header whether COOP and COEP headers are in use for faster page loads. Default: `false`

For these options to be active, they must be placed underneath the `webr` entry in the documentation header, e.g.

```markdown
---
title: WebR in Quarto HTML Documents
format: html
engine: knitr
webr: 
  show-startup-message: false
  show-header-message: false
  home-dir: '/home/r-user/'
  packages: ['ggplot2', 'dplyr']
filters:
  - webr
---
```

## Known Hiccups

As this is an exciting new frontier, we're learning as we go. Or as my friend [Lawrence](https://cs.illinois.edu/about/people/faculty/angrave) says, ["I like to build airplanes in the air-"](https://www.youtube.com/watch?v=L2zqTYgcpfg). Please take note of the following issues:


### Stuck at Loading webR...

If `webr-worker.js` or `webr-serviceworker.js` are not found when the document loads either at the root `/` or relative directory, then `Loading webR...` will appear above the code cell instead of `Run code`. Please make sure the files are at the same location as the quarto document. For example, the following structure will work:

```
.
├── demo-quarto-webr.qmd
├── webr-serviceworker.js
└── webr-worker.js
```

Still having trouble? Try specifying where the worker files are located using the `service-worker-url` option in the document's YAML header.

### Directly accessing rendered HTML

When using  `quarto preview` or `quarto render`, the rendered HTML document is being shown by mimicking a server running under `https://localhost/`. Usually, everything works in this context assuming the above directory structure is followed. However, if you **directly** open the rendered HTML document, e.g. `demo-quarto-web.html`, inside of a Web Browser, then the required WebR components cannot be loaded for security reasons. You can read a bit more about the problem in this [StackOverflow answer](https://stackoverflow.com/questions/6811398/html5-web-workers-work-in-firefox-4-but-not-in-chrome-12-0-742-122/6823683#6823683).

There are a few possible solutions to avoid requiring quarto on a local computer to directly open the rendered file: 

- [Use Chrome's `--allow-file-access-from-files` access](https://stackoverflow.com/questions/18586921/how-to-launch-html-using-chrome-at-allow-file-access-from-files-mode)
- [Use the WebServer for Chrome extension](https://chrome.google.com/webstore/detail/web-server-for-chrome/ofhbbkphhbklhfoeikjpcbhemlocgigb?hl=en)
- Or, [use NPM to obtain `local-web-server`](https://github.com/lwsjs/local-web-server)

### Speed up webR

When serving webR documents, please try to ensure the [COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) and [COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy) HTTP headers are set to speed up the process:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

For users who host their website with **[Netlify](https://www.netlify.com/)**, add to the [netlify.toml configuration file](https://docs.netlify.com/routing/headers/#syntax-for-the-netlify-configuration-file):

```
[[headers]]
  for = "/directory/with/webr/content/*"

  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

For users who deploy their site with **[GitHub Pages](https://pages.github.com/)**, please hang tight! By default, [GitHub Pages does not allow for headers to be modified](https://github.com/community/community/discussions/13309). There have been notable efforts by the GitHub Pages community to circumvent this limitation by using 
[`coi-servicworker`](https://github.com/gzuidhof/coi-serviceworker). We're currently testing it out.

For users who administer a server with `nginx`, the [`add_header`](http://nginx.org/en/docs/http/ngx_http_headers_module.html) directive
can be used to add headers into the configuration file at `/etc/nginx/nginx.conf`.

```
server {
  # Enable headers for the webr directory
  location ^~ /directory/with/webr/content {
    add_header "Cross-Origin-Opener-Policy" "same-origin";
    add_header "Cross-Origin-Embedder-Policy" "require-corp";
  }
}
```

More information may be found in `nginx`'s [Serving Static Content](http://nginx.org/en/docs/beginners_guide.html#static).

For additional justificaiton on why the headers are required, please see [webR's](https://docs.r-wasm.org/webr/latest) documentation page for [Serving Pages with WebR](https://docs.r-wasm.org/webr/latest/serving.html).

### Engine Registration

If using the `knitr` engine instead of the `jupyter` engine and you are using the original tag of `{webr}` instead of `{webr-r}`, 
there is a known warning that will appear in the render processing output of:

```r
Warning message:
In get_engine(options$engine) :
  Unknown language engine 'webr' (must be registered via knit_engines$set()).
```

This warning does not prevent or impact the ability of the `webr` filter to function. 
Though, we would like to address it at some point since it is not aesthetically pleasing.

## Acknowledgements

We appreciate the early testing feedback from [Eli E. Holmes](https://eeholmes.github.io/) and [Bob Rudis](https://rud.is/).

We also appreciate the Quarto team assisting with [setting up a new code cell type](https://github.com/quarto-dev/quarto-cli/discussions/4761#discussioncomment-5336636).

This repository builds ontop of the initial proof of concept for a standalone Quarto HTML document in:

<https://github.com/coatless-r-n-d/webR-quarto-demos>

The proof of concept leaned _heavily_ on the webR developers public-facing examples:

- [Source of Tidyverse Blog Post](https://github.com/tidyverse/tidyverse.org/pull/617/files) and [Minor fix](https://github.com/tidyverse/tidyverse.org/commit/72bb2dd7ca0b2f211498a891aa54f55ddcad5014)
- [webR documentation landing page](https://github.com/r-wasm/webr/blob/53acd8861c44f1f167941d0a40f62b0cc23852da/src/docs/index.qmd#L23-L68) ([Live page](https://docs.r-wasm.org/webr/latest/))

For the extension, we greatly appreciated insights from: 

- Extensions
  - [`quarto-ext/shinylive`](https://github.com/quarto-ext/shinylive)
  - [`mcanouil/quarto-elevator`](https://github.com/mcanouil/quarto-elevator)
  - [`shafayetShafee/downloadthis`](https://github.com/shafayetShafee/downloadthis/tree/main)
- Quarto Documentation
  - [Filters Documentation](https://quarto.org/docs/extensions/filters.html)
  - [Lua Development Tips](https://quarto.org/docs/extensions/lua.html)
  - [Lua API](https://quarto.org/docs/extensions/lua-api.html)
- Pandoc Documentation
  - [Example Filters](https://pandoc.org/lua-filters.html#examples)
  - [CodeBlock](https://pandoc.org/lua-filters.html#type-codeblock)

