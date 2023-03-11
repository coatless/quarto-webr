# WebR Code Extension for Quarto HTML Documents

This extension enables the `webr` engine in a Quarto HTML document. 

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
