# Explorer for Endevor

<div id="header" align="center">

[![Build Status](https://ci.eclipse.org/che4z/buildStatus/icon?job=endevorExplorer%2Fdevelopment)](https://ci.eclipse.org/che4z/job/endevorExplorer/job/master/)
[![GitHub issues](https://img.shields.io/github/issues-raw/eclipse/che-che4z-explorer-for-endevor)](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://communityinviter.com/apps/che4z/code4z)

</div>

The Explorer for Endevor VS Code extension modernizes the way you interact with Endevor, offering a user-friendly and convenient way to work with elements and inventory locations. Explorer for Endevor includes the following features:

- Add an element
- View an element
- Retrieve an element with dependencies
- View element details
- Create Endevor profiles, including Endevor inventory location profiles
- Use Zowe CLI base profiles
- Perform an Edit action
- Perform a Generate action
- Print a listing

Explorer for Endevor is a part of the [Che4z](https://github.com/eclipse/che-che4z) open-source project. The extension is also part of [Code4z](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.code4z-extension-pack), an all-round package that offers a modern experience for mainframe application developers, including the [HLASM Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.hlasm-language-support), [COBOL Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.cobol-language-support), [Zowe Explorer](https://marketplace.visualstudio.com/items?itemName=Zowe.vscode-extension-for-zowe), [COBOL Control Flow](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.ccf) and [Debugger for Mainframe](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.debugger-for-mainframe) extensions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Create Endevor Profile](#create-endevor-profile)
    - [Create Endevor Location Profile](#create-endevor-location-profile)
  - [Use Cases](#use-cases)
  - [Base Profiles](#base-profiles)
  - [Manage your Profiles](#manage-your-profiles)
  - [Environment Variables](#environment-variables)
  - [Configure Explorer for Endevor](#configure-explorer-for-endevor)
- [List of Limitations](#list-of-limitations)
- [Known Issues](#known-issues)
- [Contribute to Explorer for Endevor](#contribute-to-explorer-for-endevor)
- [Eclipse Che4z](#eclipse-che4z)
- [Technical Assistance and Support for Explorer for Endevor](#technical-assistance-and-support-for-explorer-for-endevor)

## Prerequisites

Ensure that you meet the following prerequisites before you use Explorer for Endevor:

**Client-side prerequisites**:

- Access to Endevor

**Host-side prerequisites**:

- Endevor version 18.0.12 or higher with the following PTFs applied:
  - (v18.0.x only) PTFs SO09580, SO09581, SO10013, and SO11268
  - (v18.1.x only) PTF SO11272
  - (Optional, Web Services with STC Pooling only) PTFs SO03928 and SO03929
- Endevor Web Services v2 installed and configured.

## Getting Started

Create an Endevor profile and inventory location profile and review use cases to see how you can use the full potential of Explorer for Endevor.

### Create Endevor Profile

Explorer for Endevor uses `endevor` and `endevor-location` profiles for Endevor Plug-in for Zowe CLI to access Endevor inventory locations on the mainframe and work with elements. If you already have a Endevor plug-in Zowe CLI profile, you can access inventory locations immediately, using your profile in the tree.

If you do not have a profile, you can create one in Explorer for Endevor.

**Follow these steps:**

1. Click the **Add a New Profile** button to add a new Endevor profile.
2. Enter a name for your profile.
3. Enter your Endevor URL in the `https://host:port` format.
4. (Optional) Enter your username and password to add your mainframe credentials to the profile.

   Adding your credentials to your profile lets you access different Endevor locations without having to enter your credentials more than once.

   **Notes**:

   - If your profile does not include credentials during the first session of Explorer for Endevor, you are prompted to provide credentials.
   - Passwords with 9 or more characters are treated as a _passsphrase_ by the server and are case sensitive.

5. Select one of the options that either accept or reject connections with self-signed certificates.

Your profile is now available in the tree. You can also reuse the same Endevor profile in Zowe CLI directly.

#### Create Endevor Location Profile

Once you have an Endevor profile, you need to add an Endevor location profile. Endevor location profiles consist of Endevor instance, Endevor path that includes environment, system, subsystem, stage number, and element type, CCID, and Comment. Endevor location profiles let you view and work with elements of specified Endevor locations.

**Follow these steps**:

1. Click the **+** icon next to your Endevor profile to add a new location profile.
2. Create a name for the Endevor location profile and press Enter.
3. Select an instance from the drop-down menu and press Enter.
4. Enter the Endevor path and press Enter.

   The path has the `environment/stagenumber/system/subsystem/type` format.

   **Note**: If you are unsure about the system, subsystem, or type parameters, you can substitute any of these parameters with a \* wildcard.

5. (Optional) Enter CCID and press Enter.
6. (Optional) Enter comment and press Enter.

   **Notes**:

   - If you want to skip the CCID and/or comment step, you can leave the inputs blank by pressing Enter.
   - You can cancel the creation of Endevor location profile at any step by pressing Escape.

You successfully created an Endevor profile.

If an existing `endevor-location` profile that you created in Zowe CLI does not have the instance, environment, and stage numbers parameters specified, the extension cannot reach the inventory location. In this case, recreate an inventory location profile with the entire location path so that Explorer for Endevor can access elements in the specified inventory.

### Use Cases

Review the following use cases to familiarize yourself with the basic Explorer for Endevor features:

- [Add an element](#add-an-element): You can upload an element from your workstation to a chosen Endevor location.
- [View an element](#view-an-element): You can view the contents, summary report, and source level information of the selected element.
- [View details](#view-details): You can view the details of a chosen element. The details include the environment, stage, system, subsystem, element type, and the name and extension of the element.
- [Retrieve an element](#retrieve-an-element): You can download the selected element.
- [Retrieve an element with dependencies](#retrieve-an-element-with-dependencies): You can download the selected element with dependencies.
- [Edit](#edit): The Edit action enables you to download an element to your workspace, edit and upload the selected element step by step. All you need to do is edit an element and press CTRL+S or Command+S to upload the edited element back.
- [Generate](#generate): You can call the Generate action for an element to invoke the Generate Processor that creates an executable form of the element.
- [Print listing](#print-listing): You can reveal the output of the performed Generate action.
- [Sign out](#sign-out): You can lock an Endevor element so that the element is only editable by you.
- [Sign in](#sign-in): Let you unlock a locked element. You can only unlock the elements that were locked by you.

#### Add an Element

You can upload a new element to your Endevor location. The uploaded element appears under the selected type in the tree.

**Follow these steps:**

1. Hover over an Endevor location in the tree.

   The "Add an Element" icon appears on the right side of the panel.

2. Click the "Add an Element" icon to upload a new element.

   The Explorer dialog appears. You can now select an element that you want to upload from your workstation.

3. Select an element that you want to upload from your workstation.

![Add an Element](packages/explorer-for-endevor/images/E4E-add.gif?raw=true 'Add an Element')
<br /><br />

#### View an Element

You can view the contents, summary, and source level information of an element by clicking on the element in the tree. The chosen element appears in the editor area. Viewing the contents of the element allows you to determine if you want to retrieve and work with the element.

**Follow these steps:**

1. Hover over an element that you want to view.
2. Click the element to see the contents of the element.

   The contents of the element appear in the editor area.

![View an Element](packages/explorer-for-endevor/images/E4E-view.gif?raw=true 'View an Element')
<br /><br />

#### View Details

The details of an element you want to view appear in the editor area in a separate tab.

**Follow these steps:**

1. Right-click an element.
2. Select the **View Details** option.

   The details of the element appear in the editor area.

![View Details](packages/explorer-for-endevor/images/E4E-view-details.gif?raw=true 'View Details')
<br /><br />

#### Retrieve an Element

You can download an element to your workspace and work with the element locally.

**Follow these steps:**

1. Right-click an element.
2. Select the **Retrieve** option.

   The extension downloads and places the element into your workspace. The contents of the element appear in the editor area. You can find the element in the workspace folder.

You successfully retrieved the element.

![Retrieve an Element](packages/explorer-for-endevor/images/E4E-retrieve.gif?raw=true 'Retrieve an Element')
<br /><br />

#### Retrieve an Element with Dependencies

You can download an element with dependencies to your workspace and work with the element and the dependencies locally.

**Follow these steps:**

1. Right-click an element.
2. Select the **Retrieve with dependencies** option.

   The extension downloads and places the element with dependencies into your workspace. The contents of the element appear in the editor area.

You successfully retrieved the element with dependencies.

![Retrieve with Dependencies](packages/explorer-for-endevor/images/E4E-retrieve-dep.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

#### Edit

The **Edit** action lets you download an element, edit, and upload the element back.

**Follow these steps:**

1. Right-click an element.
2. Select the **Edit** option.

   The contents of the element appear in the editor area. You can now edit the element.

3. Press **CTLR+S** or **Command+S** when you want to save and upload the edited element back.
4. Specify any accessible Endevor path and a name for the element.
5. Enter a CCID.
6. Enter a comment.
7. (Optional) Resolve conflicts between the element versions if necessary.

   **Notes:**

   - The behavior of the conflict resolution feature differs in Theia.

   - (Theia only) When you resolve a conflict, open the Command Palette by pressing **CTRL+SHIFT+P** or **CMD+SHIFT+P**, and use of the two commands: `Accept changes` or `Discard changes`.

You successfully edited, saved, uploaded the element.

![Retrieve with Dependencies](packages/explorer-for-endevor/images/E4E-edit.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

#### Generate

The **Generate** action creates an executable form of the element, together with any associated outputs such as listings. You can use the **Generate** option to run the Endevor Generate action for a selected element.

**Follow these steps:**

1. Right-click an element.
2. Select the **Generate** option.

   The successful Generate call shows a pop-up with two options **Print listing** and **Cancel** and the following message:

   ```text
   Generate successful! Would you like to see the listing?
   ```

3. (Optional) Click **Print listing** to see the Generate output.

   Alternatively, click **Cancel**.

   **Note**: You can always review the Generate output by selecting the **Print listing** option.

You successfully performed the Generate action.

If Generate is not successful, the listing is displayed automatically.

![Generate](packages/explorer-for-endevor/images/E4E-Generate.gif?raw=true 'Generate')
<br /><br />

#### Print Listing

The **Print listing** option enables you to display the most recently created listing.

**Follow these steps**:

1. Right-click an element.
2. Select the **Print listing** option.

   The contents of the listing appear in the editor area.

You successfully printed the listing.

![Print Listing](packages/explorer-for-endevor/images/E4E-Print-Listing.gif?raw=true 'Print Listing')
<br /><br />

#### Sign Out

The **Sign out** option enables you to lock an element, which prevents other user from editing the element.

**Follow these steps**:

1. Right-click an element.
2. Select the **Sign out** option.
3. Enter a CCID.
4. Enter a comment.

You successfully signed out the element.

![Sign Out](packages/explorer-for-endevor/images/E4E-Signout.gif?raw=true 'Sign Out')
<br /><br />

#### Sign In

The **Sign in** option enables you to unlock an element that earlier was signed out by you.

**Follow these steps**:

1. Right-click an element.
2. Select the **Sign in** option.

You successfully signed in the element.

### Base Profiles

You can use your Zowe CLI default base profile in Explorer for Endevor if you do not have an Endevor profile. To make your default base profile work in the extension, ensure that you specify such parameters as username, password, host, port, and rejectUnauthorized in the base profile. You can run the `zowe profiles list base-profiles --sc` in the CLI to check if you have a base profile that you can use. If you do not have a base profile and want to create one, run the following Zowe CLI command:

```shell
zowe profiles create base <baseprofileName> --user <myusername123> --password<mypassword123> --host <myhost> --port <portnumber> --reject-unauthorized false
```

Ensure that you set your newly-created base profile as the default base profile. To do so, run the following command:

```shell
 zowe profiles set-default base-profile <baseprofileName>
```

For more information, see [the Base Profile section](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#base-profiles) on Zowe Docs.

### Manage your Profiles

You can perform the following actions to manage your profiles:

- **Edit a profile**: You can edit a profile or update your credentials, using the Zowe CLI and the `zowe profiles update endevor-profile <profileName>` and `zowe profiles update endevor-location-profile <profileName>` command. The commands enable you to update the details of existing profiles. If you use the CLI commands to update your profile, ensure that you click the refresh button in the extension so that the changes take effect.

- **Hide a profile**: If you do not want to have some of your profiles in the tree, you can hide such profiles. To hide a profile, right-click the profile and select **Remove Profile** option.

  **Note:** The **Remove Profile** action does not permanently delete the profile.

- **Delete a profile**: You can permanently delete your profile from the extension. To delete a profile, issue the CLI command `zowe profiles delete endevor-profile <profilename>`.

### Environment Variables

You can define environment variables to execute Zowe CLI commands more efficiently. For more information, see [Using Environment Variables](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#using-environment-variables) on Zowe Docs.

### Configure Explorer for Endevor

You can configure the following settings of the extension:

- The location where the Edit command stores elements locally

- Endevor locations that are loaded at startup

- The number of parallel HTTP requests supported by Endevor

- Automatic Signout. The signout function locks elements for you. If the option is enabled, retrieved or edited elements are signed out to you. If an element is signed out to somebody else, a notification asking whether to override the signout pops up. If the option is not enabled, the extension just retrieves or edits an element without signout.

To access the Explorer for Endevor settings, click **Manage** (the cog icon on the activity bar) > **Settings** > **Extensions** > **Explorer for Endevor**.

## List of Limitations

This section lists notable limitations in the current version of Explorer for Endevor.

- Searching elements by comment and CCID is not supported.

  You can search using the instance, environment, stageNumber, system, subsystem, and type parameters.

- Zowe CLI Secure Credential Store is not supported.

  If you have SCS-enabled Endevor profiles, you need to recreate the profiles to successfully use them in Explorer for Endevor.

- Only the UTF-8 character encoding is currently supported.

## Known Issues

The following topics contain information that can help you troubleshoot problems when you encounter unexpected behavior while using Explorer for Endevor:

**Topic 1** &mdash; Removed profile persists in the tree.

**Symptoms**:

The deleted profile does not disappear from the tree after the deletion.

**Cause**:

This behavior occurs if you use the CLI command to delete your profile but do not delete the profile from the Explorer for Endevor settings.json file.

**Solution**:

To permanently delete the profile from the tree, use the extension settings.

**Follow these steps:**

1. Navigate to the VS Code settings.
2. Open Explorer for Endevor Settings and edit the settings.json file.
3. Delete the `service` and `elementLocations` properties of the profile you want to delete from the tree.
4. Save the settings.json file.

You successfully deleted your profile from the extension.

## Contribute to Explorer for Endevor

We encourage you to contribute to Explorer for Endevor.

> How can you improve Explorer for Endevor? [Open an issue in our Git repository](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)

## Eclipse Che4z

Explorer for Endevor is included with Eclipse Che version 7.6.0 and above. For more information, see the [Eclipse Che4z webpage](https://projects.eclipse.org/projects/ecd.che.che4z).

## Technical Assistance and Support for Explorer for Endevor

The Explorer for Endevor extension is made available to customers on the Visual Studio Code Marketplace in accordance with the terms and conditions contained in the provided End-User License Agreement (EULA).

If you are on active support for Endevor, you get technical assistance and support in accordance with the terms, guidelines, details, and parameters that are located within the Broadcom [Working with Support](https://techdocs.broadcom.com/us/product-content/admin-content/ca-support-policies.html?intcmp=footernav) guide.

This support generally includes:

- Telephone and online access to technical support
- Ability to submit new incidents 24x7x365
- 24x7x365 continuous support for Severity 1 incidents
- 24x7x365 access to Broadcom Support
- Interactive remote diagnostic support

Technical support cases must be submitted to Broadcom in accordance with guidance provided in “Working with Support”.

Note: To receive technical assistance and support, you must remain compliant with “Working with Support”, be current on all applicable licensing and maintenance requirements, and maintain an environment in which all computer hardware, operating systems, and third party software associated with the affected Broadcom software are on the releases and version levels from the manufacturer that Broadcom designates as compatible with the software. Changes you elect to make to your operating environment could detrimentally affect the performance of Broadcom software and Broadcom shall not be responsible for these effects or any resulting degradation in performance of the Broadcom software. Severity 1 cases must be opened via telephone and elevations of lower severity incidents to Severity 1 status must be requested via telephone.

---

Copyright © 2020 Broadcom. The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
