# Changelog

You can find all notable changes to Explorer for Endevor in this document.

## [0.12.0] &ndash; 2021-05-10

### Added

- Added the following new features that enable you to:
  - Create Endevor profiles and Endevor inventory location profiles
  - Use Zowe CLI base profiles
  - Perform an Edit action
  - Perform a Generate action
  - Print a listing
- Added the number of parallel HTTP requests supported by Endevor setting. You can now balance the Endevor load for smaller Endevor instances with a limited amount of resources

### Changed

- Updated the tree view. This will remove your profiles from the tree
  > Ensure that you add your profiles back by clicking **Add a new profile**.
- Updated the documentation

## [0.11.1] &ndash; 2020-12-11

### Fixed

- Fixed the issue with activation when you delete a profile from Zowe CLI

## [0.11.0] &ndash; 2020-11-13

### Added

- Added the output channel, "Explorer for Endevor", for logs

### Changed

- Moved Endevor Location connections from workspace settings to user settings
  > Ensure that you delete the `endevor.connections` entry from the Workspace settings if it exists.
- Improved messaging for core functionalities
- Updated the documentation

### Fixed

- Fixed the connections persistence

## [0.10.0] &ndash; 2020-06-25

### Added

- Added the profile interoperability feature for Endevor Plug-in for Zowe CLI, which enables you to:
  - create a profile
  - use existing profiles
  - automatically load the default profile
- Added the dependency on `@broadcom/endevor-for-zowe-cli` npm package
- Added the dependency on `@zowe/imperative` npm package
- Updated the documentation

### Removed

- Endevor Bridge for Git support
- The dependency on `request` npm package

## [0.9.1] &ndash; 2020-03-02

### Changed

- Updated the documentation
- Changed the license to EPL 2.0
- Added an open-source release. Moved the project codebase to the public repository under EPL 2.0 License

## [0.9.0] &ndash; 2019-09-13

### Added

- Added the New Host Creation feature

### Changed

- UX Enhancements

## [0.8.1] &ndash; 2019-08-21

### Changed

- Changed the category in package.json
- Expanded the list of prerequisites

### Fixed

- Fixed Theia 0.9

## [0.8.0] &ndash; 2019-08-16

Enhancements:

### Added

- Added the third-party license texts

### Changed

- Changed the extension name
- Corrected the links
