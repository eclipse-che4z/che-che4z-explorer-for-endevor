<!--
 Copyright (c) 2020 Broadcom.
 The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.

 This program and the accompanying materials are made
 available under the terms of the Eclipse Public License 2.0
 which is available at https://www.eclipse.org/legal/epl-2.0/

 SPDX-License-Identifier: EPL-2.0

 Contributors:
   Broadcom, Inc. - initial API and implementation
 -->

# Manual Browser Tests

This document contains the set of manual tests that are to be performed in a browser against an instance of the Theia editor with the Explorer for Endevor extension.

## Explorer for Endevor is Registered

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
Then the browser should navigate to the Explorer for Endevor screen
```

## Locate Elements

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
Then Extension Window Title should be `Explorer for Endevor`
```

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
Then the Add Profile Element should be present
```

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click on Add New Profile
And fill in all the details
Then Profile should be added
```

## Add Configurations

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click on Create a new profile
And click on a Add a New Configuration (+) symbol near created profile
Then It should display list of configurations
And You can add any confiuration to the profile
```

## Rename Configuration name

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click to Configuration name
And click on Rename Configuration (Pencil Symbol)
Then It should rename the Configuration name
```

## Remove Configuration

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click on Remove (Trash Symbol Next to Configuration name)
Then It should remove the Configuration
```

## Add Filters

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click on created profile
And click on Added configuration
And click on Add Filter(+ symbol) next to filter
And a New input box pops up for adding filter
And I Enter All the details and press Enter
Then Filter should be added under the configuration
```

## Hide Profile

```gherkin
Given I have a browser open
And Theia is loaded
When I click on Explorer for Endevor Extension icon
And click on Remove Profile (Trash symbol next to created profile)
Then Profile should be removed from the tree view
But the Profile should not be deleted (it should still be avaible in the create profile dialogue)
```
