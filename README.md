# Synvert README

Synvert vscode extension provides an alternative search / replace based on AST nodes.

It supports Typescript, Javascript and Ruby so far.

## Features

### Search and replace

After adding a snippet, you can search the code, and replace all or any of the results.

\!\[Search and Replace\]\(demos/search-and-replace-1.gif\)

### Search a snippet

You can search a snippet by group, name or description.

\!\[Search snippet\]\(demos/search-snippet-1.gif\)

### Generate a snippet

You can generate a snippet by some input codes and output codes.

\!\[Generate snippet\]\(demos/generate-snippet-1.gif\)

## Requirements

Javascript and typescript are supported internally.

Ruby is supported by `synvert` gem.

## Extension Settings

This extension contributes the following settings:

* `synvert.ruby.enable`: enable/disable synvert ruby

## Known Issues

Synvert vscode extension searches based on AST nodes, so it's slower than than the traditional search / replace.

But we are still in active development to improve the performance.

**Enjoy!**
