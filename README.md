# webR Code Extension for Quarto HTML Documents

This extension enables the [webR](https://docs.r-wasm.org/webr/latest/) code cell in a Quarto HTML document. 

The goal of [webR](https://docs.r-wasm.org/webr/latest/) is to: 

> run R code in the browser without the need for an R server to execute the code

For more details on [webR](https://docs.r-wasm.org/webr/latest/), please see: 

- [webR Documentation](https://docs.r-wasm.org/webr/latest/)
- [webR Source Code](https://github.com/r-wasm/webr/)

## Installation 

To use this extension in a Quarto project, install it from within the project's working directory:

``` bash
quarto install extension coatless/quarto-webr
```

## Usage

For each document, place the the `webr` filter in the document's header:

```yaml
filters:
  - webr
```

Then, place the code for `webr` in a code block marked with `{webr}`

````markdown
---
title: WebR in Quarto HTML Documents
format: html
filters:
  - webr
---

This is a webr-enabled code cell in a Quarto HTML document.

```{webr}
fit = lm(mpg ~ am, data = mtcars)
summary(fit)
```
````

When quarto render or preview is called, the filter will add two files to the working directory `webr-worker.js` and `webr-serviceworker.js`. These files allow for the webR session to be started.

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

### Speed up webR

When serving webR documents, please try to ensure the [COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) and [COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy) HTTP headers are set to speed up the process:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

For more details, please see: <https://docs.r-wasm.org/webr/latest/serving.html>
Note, this requires a "hack" for GitHub Pages.

### Engine Registration

If using the `knitr` engine instead of the `jupyter` engine, there is a known warning
that will appear in the render processing output of:

```r
Warning message:
In get_engine(options$engine) :
  Unknown language engine 'webr' (must be registered via knit_engines$set()).
```

This warning does not prevent or impact the ability of the `webr` filter to function. 
Though, we would like to address it at some point since it is not aesthetically pleasing.


## Acknowledgements

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
