# Change Log

## [Unreleased]

## [0.4.2] - 2022-10-24

- Remove snippet if failed to generate snippet
- Avoid multiple withinFile in `formatSnippet`

## [0.4.1] - 2022-10-19

- Fix error handling when generating a snippet

## [0.4.0] - 2022-10-15

- Allow to write snippet without `new Synvert.Rewriter`

## [0.3.2] - 2022-10-14

## Fixed

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
- Test ruby snippet in parallel if `ruby.number_of_workers` is greather than 1

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
- Do not install synvert gem globaly

## [0.1.1] - 2022-09-30

### Fixed
- Clear synvert rewriter before eval snippet

## [0.1.0] - 2022-09-28

- Initial release
