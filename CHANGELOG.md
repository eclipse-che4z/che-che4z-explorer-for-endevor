# Changelog

You can find all notable changes to Explorer for Endevor in this document.

## [1.3.1] &ndash; 2022-11-23

### Fixed

- Fixed an issue with collapsing the Endevor tree on refresh.
- Fixed an issue with fetching environments, systems and subsystem outside of the specified Endevor map.

### Changed

- Improved the Endevor workspace sync related messages.

## [1.3.0] &ndash; 2022-11-04

### Added

- Added the experimental feature that enables you to create a workspace and synchronize it with Endevor on the mainframe.
- Added an ability to correct Endevor connection information and credentials for the current VSCode session.
- Added cancellation for the connection testing and Endevor tree refresh operations.
- Added Zowe V2 Conformance information to README.
- Added Get Started with Explorer for Endevor VSCode Walkthrough.
- Added Introduction to the Endevor Synchronized Workspace VSCode Walkthrough.

### Fixed

- Fixed the immediate user lockout if mainframe credentials were specified incorrectly.
- Fixed the up the map elements fetching if the Endevor location was specified using wildcards.
- Fixed the code regression messages. Now the messages are identified as warnings and are more visible.

### Changed

- Improved the extension UI. Now the Endevor tree is provided with welcome views and the get started walkthrough.
- Improved the indication of the error messages for incorrect credentials or connection issues.
- Improved the Endevor connection and inventory location related dialogs and messages.

## [1.2.0] &ndash; 2022-08-12

### Added

- Added the functionality to create Endevor connections that work independently from Zowe profiles.
- Added the compatibility with the Zowe Secure Credential Store.
- Added the functionality that reads the Zowe Global Team and User Configuration files.
- Added the **Add an Inventory Location** button to the extension tree.
- Added the extension tree nodes tooltips based on their real values.
- Added the dialogs descriptions about the real connection and inventory location values.
- Added the UI option to submit the extension issue.
- Added the **Cancel** button to the Endevor Web Services URL and Endevor configurations validation.
- Added the extension setting that resolves the retrieved file extension based on the different strategies.
- Added more telemetry events.

### Fixed

- Fixed the performance issue with the long list of elements that are fetched from Endevor.
- Fixed the issue with ignoring the rejectUnauthorized value from the Zowe Base profiles.
- Fixed the issue with displaying non-existing Zowe profiles in the extension tree.
- Fixed the issue that causes the refreshing of the extension tree after errors.
- Fixed the issue that causes invalid Zowe profiles be accessible in the extension tree.

### Changed

- Changed the edited elements file system path to an internal one.
- Changed the dialogs with an option to create an Endevor connection or inventory location right away.
- Changed the extension tree to show full element names.

## [1.1.1] &ndash; 2022-05-23

### Added

- Added the function that tests connections to Endevor services in the Endevor profiles creation step.
- Support for v1 Endevor REST API (Endevor version 18.0).
- Added the override signout capability for the signout feature.

### Fixed

- Fixed the issue that prevented you from using the default HTTPS port value in the Endevor profiles creation step.

## [1.1.0] &ndash; 2022-04-01

### Added

- Added the generate an element with copyback and generate with no source features.
- Added the Signout-overriding functionality to the generate an element feature.

### Changed

- The **Remove profile** context menu item is changed to **Hide profile** to avoid confusion.
- Now multiple notification messages are displayed in one message upon successful element generation.
- Changed the VS Code version requirement. Ensure that you use VS Code 1.58.0 or higher.

### Fixed

- Fixed an issue with the signout error recovery attempt when an element is edited and uploaded into a different location.
- Fixed an issue that prevented the extension from updating an Endevor map tree after uploading the edited element into a new location.

## [1.0.2] &ndash; 2022-03-25

### Fixed

- Fixed an issue that prevented the extension from building an Endevor map tree if lowercased values were used in an Endevor location profile.
- Fixed an issue that caused the extension activation failure in the VSCode version 1.63.2 or lower.

## [1.0.1] &ndash; 2022-03-17

### Added

- Added alphabetical sorting to all levels of the Explorer for Endevor tree.

### Fixed

- Fixed an issue that caused the wrong representation of elements in the Explorer for Endevor tree.

## [1.0.0] &ndash; 2022-02-23

### Added

- Added the telemetry event-recording functionality.
- Added a `[MAP]` folder to the tree view. You can use the folder to store the elements that are found up the map.
- Added a `Show logs` button to the notification panel, which enables you to open the output of the extension.

### Changed

- Multiple error logging and notification events.

### Fixed

- Fixed an issue in the URI building process. Characters that may potentially break the building process are escaped.
- Fixed an issue that erroneously allowed upload dialogs to use wildcards as input.
- Fixed an issue that caused the conflict resolution command to fail when resolving reoccurring conflicts.
- Fixed an issue with retrieving and editing multiple elements with the auto signout option. Now the retrieve and edit commands correctly process all the selected elements in groups by location profiles.
- Fixed an issue with showing multiple elements for editing. An "editor already opened" error does not appear anymore.
- Fixed an issue that caused editors to close when discarding changes.

## [0.14.2] &ndash; 2022-02-01

### Fixed

- Fixed the password length limit from 8 to 100 characters. You can now take advantage of a passphrase if the passphrase is configured on the server. Unlike a password, a passphrase is case-sensitive.

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
