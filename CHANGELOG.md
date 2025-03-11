# Change Log

## [1.5.1] - 2025-03-11

### Fixed

* Install `@synvert-hq/synvert` instead of `synvert`

## [1.5.0] - 2024-06-15

### Added

* Respect `.gitignore`

### Changed

* Update `@synvert-hq/synvert-ui-common` to 1.18.0

## [1.4.0] - 2024-05-07

### Changed

- Update `@synvert-hq/synvert-ui-common` to 1.17.0
- Revert to `bin_path`
- Use `@synvert-hq/synvert-ui-common` to install and sync synvert

## [1.3.0] - 2024-04-19

### Changed

- Moving from `xinminlabs` to `synvert-hq`
- Use `@synvert-hq/synvert-ui-common` and `@synvert-hq/synvert-server-common` packages

### Added

- Add `ruby.command_path` and `javascript.command_path` configurations
- Use `commandPath` to check ruby and javascript dependencies
- Use `commandPath` to run and test snippet

## [1.2.0] - 2024-02-17

### Added

- Update `synvert-ui-common` to 1.15.2 to support `prism` parser

## [1.1.3] - 2024-01-26

### Changed

- Update `synvert-ui-common` to 1.14.2

## [1.1.2] - 2024-01-12

### Changed

- Better error message

## [1.1.1] - 2023-12-27

### Changed

- Polish `add_file`, `remove_file` and `rename_file` UI

## [1.1.0] - 2023-12-13

### Added

- Support css/less/sass/scss

### Changed

- Use `filePatternByLanguage`, `placeholderByLanguage`, `parsersByLanguage` from synvert-ui-common

## [1.0.6] - 2023-12-10

### Changed

- Use `replaceTestResult` and `replaceTestAction` from synvert-ui-common
- Use `fetchSnippets` and `generateSnippets` from synvert-ui-common

## [1.0.5] - 2023-11-29

### Changed

- Drop `synvert-core` dependency

## [1.0.4] - 2023-11-24

### Changed

- Use `runSynvertRuby` and `runSynvertJavascript` from synvert-ui-common
- Use `checkRubyDependencies` and `checkJavascriptDependencies` from synvert-ui-common

## [1.0.3] - 2023-11-03

### Fixed

- Do not display replace icon only when action type is `noop`
- Always log `runCommand` error
- Avoid duplicated logs

## [1.0.2] - 2023-10-29

### Changed

- Use `Promise.all` to check ruby and javascript version simultaneously

## [1.0.1] - 2023-10-29

### Added

- Add assets img

### Fixed

- Fix `optionIdentifier` for snippet Select

## [1.0.0] - 2023-10-22

### Added

- Add MIT License

### Changed

- Use `async`/`await` in `SidebarProvider`
- Log error when checking synvert-ruby and synvert-javascript environments
- Update `bugs.url` in `package.json`
- Set `repository` in `package.json`

## [0.12.0] - 2023-10-15

### Added

- Add parser select
- Add "Update" button to update dependencies

### Changed

- Update `synvert-core` to 2.17.2
- Make `activate` function async

## [0.11.0] - 2023-10-03

### Added

- Display and replace `group` action
- Log remote versions

### Changed

- Update `synvert-core` to 2.17.0

## [0.10.1] - 2023-05-20

### Fixed

- Try catch test results handling

## [0.10.0] - 2023-04-20

### Fixed

- Reset generatedSnippets when generating snippet

### Changed

- Work for `add_file` and `remove_file` actions

## [0.9.2] - 2023-02-23

### Fixed

- Display properly for noop action

## [0.9.1] - 2023-02-23

### Changed

- Polish result items style

## [0.9.0] - 2023-02-22

### Changed

- Read multiple generated snippets

### Added

- Display prev and next snippet links

## [0.8.3] - 2023-02-20

### Changed

- Generated javascript snippet does not require synvert-core anymore

## [0.8.2] - 2023-02-13

### Fixed

- Handle error message in stdout

### Changed

- Scroll to errorMessage if exists

## [0.8.1] - 2023-02-11

### Changed

- Allow empty inputs and outputs

## [0.8.0] - 2023-02-10

### Added

- Add `synvert.ruby.single_quote` and `synvert.ruby.tab_width` configurations
- Add `synvert.javascript.single_quote`, `synvert.javascript.semi` and `synvert.javascript.tab_width` configurations
- Add `synvert.typescript.single_quote`, `synvert.typescript.semi` and `synvert.typescript.tab_width` configurations

## [0.7.0] - 2023-02-05

### Changed

- synvert-javascript command uses kebab case
- Show no file affected message

### Fixed

- Reset snippet select after changing language

## [0.6.2] - 2023-02-04

### Changed

- Enable to log json object

### Fixed

- Fix typescript search

## [0.6.1] - 2023-01-14

### Added

- Scroll to search results after searching

### Changed

- Update images path in README

## [0.6.0] - 2023-01-03

### Changed

- Fetch all snippets remotely, filter and sort locally

### Fixed

- Send language option to generate snippet request

## [0.5.0] - 2022-12-20

### Added

- Add "How to write inputs / outputs" link
- Add `javascript.enabled` and `typescript.enabled` configurations
- Add `synvert.javascript.max_file_size` and `synvert.typescript.max_file_size` configurations
- Use `synvert` npm

### Changed

- Select language instead of extension

### Fixed

- Set input/output placeholder for different language

## [0.4.3] - 2022-10-25

### Changed

- Update `synvert-core` to 1.21.1

## [0.4.2] - 2022-10-24

### Changed

- Remove snippet if failed to generate snippet

### Fixed

- Avoid multiple withinFile in `formatSnippet`

## [0.4.1] - 2022-10-19

### Fixed

- Fix error handling when generating a snippet

## [0.4.0] - 2022-10-15

### Changed

- Allow to write snippet without `new Synvert.Rewriter`

## [0.3.2] - 2022-10-14

### Fixed

- Fix error handling for search and replace

## [0.3.1] - 2022-10-13

### Fixed

- Eval after formatting snippet

## [0.3.0] - 2022-10-13

### Added

- Add key binding `ctrl+shift+s` / `cmd+shift+s`

## [0.2.0] - 2022-10-11

### Added

- Add `ruby.number_of_workers` configuration
- Test ruby snippet in parallel if `ruby.number_of_workers` is greater than 1

### Changed

- Use `evalSnippet` from synvert-core

## [0.1.5] - 2022-10-07

### Changed

- Empty results after changing snippet

## [0.1.4] - 2022-10-06

### Added

- Check gem version and update gem

## [0.1.3] - 2022-10-02

### Added

- Highlight selected search item

### Fixed

- Disable both search and replace all buttons

## [0.1.2] - 2022-10-01

### Added
- Show both old code and new code in search results

### Fixed
- Do not install synvert gem globally

## [0.1.1] - 2022-09-30

### Fixed
- Clear synvert rewriter before eval snippet

## [0.1.0] - 2022-09-28

- Initial release
