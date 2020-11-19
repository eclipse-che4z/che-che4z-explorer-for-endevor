# Tech Debt

- Add testing

  - Jenkins? Do we want to consider alternatives since this is open source?
  - use `vscode-test` for vscode integration tests + Mocha
  - Jest for unit test and integration tests other than vscode
  - No mocking of vscode package! (it brings a lot of maintenance and up front effort)
    - split code accordingly (refactor) so that vscode interaction is as containerized as possible
  - we can reuse components from B4G Explorer (pipeline setup, docker image, test runner, task runner setup etc)
  - take folder structure into consideration when composing tests(still work in progress for B4G.E)
    - naming guidelines

- Imperative logger
  - fix issue with logging location
    - now it goes to `extensionPath` = `C:\Users\ad670553\.scode\extensions\broadcommfd.explorer-for-endevor-0.10.0\logs`
    - [@Zach] maybe discuss if we want to keep it this way and document the location
- Create a dedicated channel for console output (same as B4G Explorer)

- There is a webview (activation event) which I don't think it's used anywhere. Gots to go!

- Improve application robustness

  - Enable the following in `tsconfig.json`:

    - "strict": true
    - "noImplicitAny": true
    - "noImplicitReturns": true
    - "noFallthroughCasesInSwitch": true
    - "noUnusedParameters": true
    - [@Vit] Maybe this as well or others?:
    - "noUnusedLocals": true

  - `tsc -p ./` with only first 2 enabled yields 69 errors. Easy peasy lemon squeezy :smile:
  - with all of them on `true` it's up to 80
  - this action will carry some refactoring

- refactor EndevorController

  - cyclomatic complexity too high
  - `foreach` loop with 5 level of nesting `if` conditions (hard to follow :worried:)

- Fix licence and implement automation!

- Move from OOP to FP ?!?

# Features

- Base profile

  - missing common logic around profile management! Needs to be implemented over and over again :cry:

- New Commands
  - Add (upload new file)
  - Update (edit and replace existing)
  - Generate (trigger Endevor specific action)

# NEW NOTES

- remove unused imports (fixable by tools)
- get rid of imperative logger (rework profile initialization)
- why we have a Profile object that can create a session, but also have `buildSession` function in utils.

## Tooling:

- tslint --> eslint
- add prettier
- add webpack
- remove vscode extension recommendations

## Dependencies:

- move to imperative from 4.6.0 to 4.7.4
- move to endevor for zowe cli from 5.1.1 to 6.1.0

## Dev Dependencies

- "tslint-sonarts": "^1.9.0" DEPRECATED - eslint-plugin-sonarjs recommended
