# WebR Code Extension for Quarto HTML Documents

This extension enables the [webR](https://docs.r-wasm.org/webr/latest/) engine in a Quarto HTML document. 

The goal of webR is to: 

> run R code in the browser without the need for an R server to execute the code

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

````
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
