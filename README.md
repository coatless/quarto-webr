# webR Code Extension for Quarto HTML Documents

This extension enables the [webR](https://docs.r-wasm.org/webr/latest/) code cell in a Quarto HTML document. 

![`quarto-webr` Filter in Action](https://i.imgur.com/NCTDwUk.gif)

Check out the example in action [here](https://coatless.github.io/quarto-webr/webr-readme-example.html)!

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

The rendered document can be viewed online [here](https://coatless.github.io/quarto-webr/webr-readme-example.html).

When `quarto render` or `quarto preview` is called, the filter will execute under `engine: knitr`. 
During the execution, the filter adds two files to the working directory: `webr-worker.js` and `webr-serviceworker.js`. These files allow for the 
`webR` session to be started and must be present with the rendered output. 

**Note:** If `engine: knitr` is not specified, then the `jupyter` compute engine will be used by default.

There are many more customization options that are available. Please see the [customization documentation](https://coatless.github.io/quarto-webr/webr-meta-options.html) for more examples.

## Help

For troubleshooting help, please see our [troubleshooting page](https://coatless.github.io/quarto-webr/webr-troubleshooting.html).

To report a bug, please [add an issue](https://github.com/coatless/quarto-webr/issues/new) to the repository's [bug tracker](https://github.com/coatless/quarto-webr/issues).

Want to contribute a feature? Please open an issue ticket to discuss the feature before sending a pull request. 

## Acknowledgements

Please see our [acknowledgements page](https://coatless.github.io/quarto-webr/webr-acknowledgements.html).
