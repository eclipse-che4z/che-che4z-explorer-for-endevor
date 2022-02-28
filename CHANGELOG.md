# Changelog

You can find all notable changes to Explorer for Endevor in this document.

## [1.0.0] &ndash; 2022-02-23

### Added

- Added the telemetry event-recording functionality.
- Added a `[MAP]` folder to the tree view. You can use the folder to store the elements that are found up the map.
- Added a `Show logs` button to the notification panel, which enables you to open the output of the extension.

### Changed

- Multiple error logging and notification events.

### Fixed

- Fixed an issue in the URI building process. Characters that may potentially break the building process are escaped.
- Upload dialogs now prevent wildcards as input.
- Fixed an issue that caused the conflict resolution command to fail when resolving reoccurring conflicts.
- Fixed an issue with retrieving, editing multiple elements with auto signout option. Now it processes all the selected elements in groups by each location profile.
- Fixed an issue with showing multiple elements for editing. An "editor already opened" error does not appear anymore.
- Fixed an issue that caused editors to close when discarding changes.

## [0.14.2] &ndash; 2022-02-01

### Fixed

- Fix password length limit from 8 to 100 characters. You can now take advantage of a passphrase if the passprhase is configured on the server. Unlike a password, a passphrase is case sensitive.

## [0.14.1] &ndash; 2021-12-21

### Fixed

- Fixed the issue that caused the accept/discard change buttons to disappear in the diff editor while saving an edited element.

### Changed

- Updated the documentation. Changed the old product names to new ones.

## [0.14.0] &ndash; 2021-11-25

### Added

- Added the sign out and sign in features.
- Added the Automatic Signout setting.
- Added the Add an Element feature.

## [0.13.2] &ndash; 2021-11-12

### Added

- Added the compatibility for the latest Endevor WebServices charset response headers

## [0.13.1] &ndash; 2021-08-27

### Added

- Added the alphabetical sorting into the Endevor type nodes of the tree view.

### Changed

- Updated the documentation.

## [0.13.0] &ndash; 2021-07-05

### Added

- Added the conflict resolution feature for uploaded elements.

### Changed

- Removed Zowe CLI and CA Endevor plug-in for Zowe CLI from the client installation prerequisites.

## [0.12.1] &ndash; 2021-05-25

### Fixed

- Fixed an issue with rejectUnauthorized when listing endevor instances

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
