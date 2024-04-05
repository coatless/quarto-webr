# webR Extension for Quarto

This community developed Quarto extension enables the [webR](https://docs.r-wasm.org/webr/latest/) code cell within various [Quarto](https://quarto.org/) formats, including [HTML](https://quarto.org/docs/output-formats/html-basics.html), [RevealJS](https://quarto.org/docs/presentations/revealjs/), [Websites](https://quarto.org/docs/websites/), [Blogs](https://quarto.org/docs/websites/website-blog.html), and [Books](https://quarto.org/docs/books). 

![`quarto-webr` Filter in Action](https://i.imgur.com/JIQZIZ8.gif)

Take a look at a live example of the extension in action [here](https://quarto-webr.thecoatlessprofessor.com/examples/readme)! To delve deeper into the extension's capabilities, see our comprehensive [documentation website](https://quarto-webr.thecoatlessprofessor.com/).

Looking for a Python version? Check out [`quarto-pyodide`](https://github.com/coatless-quarto/pyodide)!

> [!NOTE]
> Please note that the `{quarto-webr}` Quarto extension is a community-driven initiative and is **not** affiliated with Posit, Quarto, or the main [webR](https://docs.r-wasm.org/webr/latest/) project. Its evolution and maintenance stem solely from the collective efforts of community members.

## Background

If you're new to [webR](https://docs.r-wasm.org/webr/latest/), this cutting-edge technology empowers you to:

> "run R code in the browser without the need for an R server to execute the code."

For a deeper understanding of [webR](https://docs.r-wasm.org/webr/latest/), explore the following resources:

- [webR Documentation](https://docs.r-wasm.org/webr/latest/)
- [webR Source Code](https://github.com/r-wasm/webr/)

## Quick Start Video Guide

For those new to Quarto and Quarto Extensions, we highly recommend checking out this informative [YouTube video](https://youtu.be/DoRR2S5lLvk?t=5) to get started quickly:

[![Creating your first webR-powered Quarto Document inside of RStudio](https://i3.ytimg.com/vi/DoRR2S5lLvk/maxresdefault.jpg)](https://youtu.be/DoRR2S5lLvk?t=5)

## Installation 

To use this extension in a [Quarto project](https://quarto.org/docs/projects/quarto-projects.html), install it from within the project's working directory by typing into **Terminal**:

``` bash
quarto add coatless/quarto-webr
```

![Demonstration of using the Terminal tab to install the extension.](https://i.imgur.com/aVuBdyN.png)

After the installation process is finished, the extension will be readily available for Quarto documents within the designated working directory. Please note that if you are working on projects located in different directories, you will need to repeat this installation step for each of those directories.

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

This is a webR-enabled code cell in a Quarto HTML document.

```{webr-r}
fit = lm(mpg ~ am, data = mtcars)

summary(fit)
```
````

The rendered document can be viewed online [here](https://quarto-webr.thecoatlessprofessor.com/examples/readme).

 **Note:** If you don't specify the `engine: knitr`, the default compute engine used will be `jupyter`. This could trigger prompts to install Python. However, if you specify `engine: knitr`, there's no need to install Python.

There are many more customization options that are available. Please see the [customization documentation](https://quarto-webr.thecoatlessprofessor.com/qwebr-meta-options.html) for more examples.

For specific deployment usage cases, please see [Templates](https://quarto-webr.thecoatlessprofessor.com/qwebr-deployment-templates.html). 

## Help

For troubleshooting help, please see our [troubleshooting page](https://quarto-webr.thecoatlessprofessor.com/qwebr-troubleshooting.html).

To report a bug, please [add an issue](https://github.com/coatless/quarto-webr/issues/new) to the repository's [bug tracker](https://github.com/coatless/quarto-webr/issues).

Want to contribute a feature? Please open an issue ticket to discuss the feature before sending a pull request. 

## Acknowledgements

Please see our [acknowledgements page](https://quarto-webr.thecoatlessprofessor.com/qwebr-acknowledgements.html).
