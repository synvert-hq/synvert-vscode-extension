# Synvert README

Synvert vscode extension provides a find / replace alternative based on AST nodes.

Why do you need Synvert?

1. It's more accurate. e.g. it can find parameters in function declaration in typescript but ignore the arguments in function call.

2. It's more powerful. e.g. it can find all unused imports in typescript and remove them.

It supports Typescript, Javascript and Ruby so far.

## Features

- Search and replace. After adding a snippet, you can search the code, and replace all or any of the results.

![Search and Replace](demos/search-and-replace-1.gif)

- Search a snippet. You can search a snippet by group, name or description.

![Search snippet](demos/search-snippet-1.gif)

- Generate a snippet. You can generate a snippet by some input codes and output codes.

![Generate snippet](demos/generate-snippet-1.gif)

- Adopt a short snippet. You can write a short snippet without `new Synvert.Rewriter`.

![Short snippet](demos/short-snippet-1.png)

## Requirements

Javascript and typescript are supported internally.

Ruby is supported by `synvert` gem.

## Extension Settings

This extension contributes the following settings:

* `synvert.ruby.enable`: enable/disable synvert ruby, default is true.
* `synvert.ruby.number_of_workers`: number of workers to run synvert ruby, default is 4.
* `synvert.javascript.enable`: enable/disable synvert javascript, default is true.
* `synvert.typescript.enable`: enable/disable synvert typescript, default is true.

## Key Bindings

* `ctrl+shift+s` / `cmd+shift+s`: open synvert sidebar view.

## Known Issues

Synvert vscode extension searches based on AST nodes, so it's slower than than the traditional find / replace.

But we are still in active development to improve the performance.

**Enjoy!**
