# Explorer for Endevor

<div id="header" align="center">

[![Build Status](https://ci.eclipse.org/che4z/buildStatus/icon?job=endevorExplorer%2Fdevelopment)](https://ci.eclipse.org/che4z/job/endevorExplorer/job/master/)
[![GitHub issues](https://img.shields.io/github/issues-raw/eclipse/che-che4z-explorer-for-endevor)](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://join.slack.com/t/che4z/shared_invite/enQtNzk0MzA4NDMzOTIwLWIzMjEwMjJlOGMxNmMyNzQ1NWZlMzkxNmQ3M2VkYWNjMmE0MGQ0MjIyZmY3MTdhZThkZDg3NGNhY2FmZTEwNzQ)

</div>

Explorer for Endevor is a part of the [Che4z](https://github.com/eclipse/che-che4z) open-source project. The extension is also part of [Code4z](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.code4z-extension-pack), an all-round package that offers a modern experience for mainframe application developers, including [HLASM Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.hlasm-language-support), [COBOL Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.cobol-language-support), [Zowe Explorer](https://marketplace.visualstudio.com/items?itemName=Zowe.vscode-extension-for-zowe), and [Debugger for Mainframe](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.debugger-for-mainframe) extensions.

The Explorer for Endevor VS Code extension modernizes the way you interact with CA Endevor® SCM, using a user-friendly, intuitive IDE interface and provides the following benefits:

- View an element
- Retrieve an element with dependencies
- View element details
- Create and manage your Endevor profiles, including Endevor inventory location profiles and base profiles
- Perform the Edit action
- Perform the Generate action and show listings

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Create a Profile](#create-a-profile)
  - [Base Profiles](#base-profiles)
  - [Profile Persistence](#profile-persistence)
  - [Manage your Profiles](#manage-your-profiles)
  - [Sample Use Cases](#sample-use-cases)
- [List of Limitations](#list-of-limitations)
- [How to Contribute](#how-to-contribute)
- [Eclipse Che4z](#eclipse-che4z)
- [Technical Assistance and Support for Explorer for Endevor](#technical-assistance-and-support-for-explorer-for-endevor)

## Prerequisites

Ensure that you meet the following prerequisites before you can use Explorer for Endevor:

- Access to Mainframe
- Access to CA Endevor® SCM
- CA Endevor® SCM version 18.0.12 or higher with the following PTFs applied:
  - (v18.0.x only) PTFs SO09580, SO09581, SO10013, and SO11268
  - (v18.1.x only) PTF SO11272
  - (Optional)(Web Services with STC Pooling only) PTFs SO03928 and SO03929
- CA Endevor® SCM Web Services v2 installed and configured. For more information, see the [CA Endevor® SCM documentation](https://techdocs.broadcom.com/us/en/ca-mainframe-software/devops/ca-endevor-software-change-manager/18-1/how-to-enable-web-services.html)
- Zowe CLI v1-LTS
- CA Endevor plug-in for Zowe CLI version 6.0.0

## Getting Started

Create an Endevor profile and inventory location profile and review use cases to see how you can use the full potential of Explorer for Endevor.

### Create a Profile

Explorer for Endevor uses Zowe CLI `endevor` and `endevor-location` profiles for CA Endevor SCM Plug-in for Zowe CLI to access Endevor inventory locations on the mainframe and work with elements. If you already have a CA Endevor plug-in Zowe CLI profile, you can access inventory locations immediately, using your profile in the tree.

**Note**: If an existing `endevor-location` profile that you created in Zowe CLI does not have the instance parameter specified, the extension cannot reach the inventory location. You need to recreate an inventory location profile with the entire location path so that Explorer for Endevor can access elements in the specified inventory.

If you do not have a profile, you can create one in Explorer for Endevor.

**Follow these steps:**

1. Click the **Add a New Profile** button to add a new Endevor profile.
2. Enter a name for your profile.
3. Enter your Endevor URL in the `https://host:port` format.
4. (Optional) Enter your username and password to add your mainframe credentials to the profile.

   Adding your credentials to your profile lets you access different Endevor locations without entering your credentials.

   **Note**: If your profile does not include credentials, during the first session of Explorer for Endevor, you are prompted to provide credentials.

5. Select the **False: Accept connections with self-signed certificates** option when you are at the last step of the profile creation process.

   **Note**: Calls with rejectUnauthorised are not supported.

Your profile is now available in the tree. You can also use the same profile in Zowe CLI directly.

> Tip: You can create multiple profiles if necessary.

Once you have an Endevor profile, you need to add an Endevor location profile. Endevor location profiles constist of Endevor instance, Endevor path that includes environment, system, subsystem, stage number, and element type, CCID, and Comment. Endevor location profiles let you view and work with elements of specified Endevor locations.

Follow these steps:

1. Click the **+** icon next to your Endevor profile to add a new location profile.
2. Create a name for the Endevor location profile and press Enter.
3. Select an instance from the quick-pick menu and press Enter.
4. Enter Endevor path and press Enter.

   The path has the `environment/stage/system/subsystem/type` format.

   **Note**: If you are unsure about the `type` parameter, you can substitute the parameter with a \* wildcard.

5. (Optional) Enter CCID and press Enter.
6. (Optional) Enter comment and press Enter.

   **Notes**:

   - If you want to skip the CCID and/or comment step, you can leave the inputs blank by pressing Enter.
   - You can cancel the creation of Endevor location profile at any step by pressing Escape.

### Base Profiles

You can use your Zowe CLI default base profile in Explorer for Endevor if you do not have an Endevor profile. To make your default base profile work in the extension, ensure that you specify such parameters as `username`, `password`, `host`, `port`, and `rejectUnauthorized` in the base profile. You can run the `zowe profiles list base-profiles --sc` in the CLI to check if you have a base profile that you can use. If you do not have a base profile and want to create one, run the following Zowe CLI command:

```shell
zowe profiles create base <baseprofileName> --user <myusername123> --password<mypassword123> --host <yourhost> --port <portnumber> --reject-unauthorized false
```

Make sure that you set your newly-created base profile as the default base profile. To do so, you can run the following command:

```shell
 zowe profiles set-default base-profile <baseprofileName>
```

For more information, see [the Base Profile section](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#base-profiles) on Zowe Docs.

In addition, base profiles can contain a token that enables you to access services, using API Mediation Layer. For more information, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-usingcli.html#integrating-with-api-mediation-layer) on Zowe Docs.

### Order of Precedence

Explorer for Endevor uses the following order of precedence for loading the default profile types that are used by the extension:

1. Endevor profiles.

2. Default base profile.

3. Base profiles with tokens.

If you do not have an Endevor profile, the extension uses your default base profile. If your base profile do not include necessary parameters, the extension uses API ML tokens.

### Profile Persistence

Explorer for Endevor loads your default Endevor profile into the tree. When you create a new Endevor profile in the extension, or select an existing Endevor profile to use, the profile also appears in the tree.

### Manage your Profiles

You can edit a profile or update your credentials, using the Zowe CLI and the `zowe profiles update endevor-profile <profileName>` and `zowe profiles update endevor-location-profile <profileName>` command. The commands let you update the details of existing profiles.

If you do not want to have some of your profiles in the tree, you can hide such profiles. To do so, right-click on a profile and select **Remove Profile** option.

**Note:** The **Remove Profile** action does not permanently delete the profile. When you click the **Add a New Profile** icon again, you can add any previously created profiles again. You can only permanently delete a profile, using the Zowe CLI.

If you delete your Endevor profile, using Zowe CLI, the .yaml file disappears from your .zowe folder but the extension still loads the profile into the tree. However, the profile is not functional anymore and the extension shows the following pop-up message:

```text
There is no valid credential in the Endevor profile and default base profile (see OUTPUT for more details)
```

Such behavior occurs because the profile is listed in the VS Code settings.json file. To completely delete the profile from the extension, follow these steps:

1. Navigate to the VS Code settings.
2. Open Explorer for Endevor Settings and edit the settings.json file.
3. Erase the `service` and `elementLocations` properties of the profile you want to delete from the tree.
4. Save the settings.json file.
5. Refresh the tree by clicking the **Refresh** button at the top of the extension panel.

### Environment Variables

You can set the location on your workstation where Zowe CLI creates the .zowe directory, which contains log files, profiles, and plug-ins for the extension:

| Environment Variable | Description                      | Values                          | Default                              |
| -------------------- | -------------------------------- | ------------------------------- | ------------------------------------ |
| `ZOWE_CLI_HOME`      | Zowe CLI home directory location | Any valid path on your computer | Your computer default home directory |

### Sample Use Cases

Review the following use cases to familiarize yourself with the basic Explorer for Endevor features:

- [View an element](#view-an-element): You can view the content of the selected element.
- [View details](#view-details): You can view the details of a chosen element. The details include the environment, stage, system, subsystem, element type, and the name and extension of the element.
- [Retrieve an element](#retrieve-an-element): You can download the selected element.
- [Retrieve an element with dependencies](#retrieve-an-element-with-dependencies): You can download the selected element with dependencies.
- [Edit](#edit): The Edit action lets you download an element to your workspace, edit and upload the selected element step by step. All you need to do is edit an element and press CTRL+S or Command+S to upload the edited element back.
- [Generate](#generate): You can call the `Generate` action for an element to invoke the Generate Processor that creates an executable form of the element.
- [Show listing](#show-listing): You can reveal the output of the performed Generate action.

#### View an Element

You can view the contents of an element by clicking on the element in the tree. The chosen element appears in the editor area. Viewing the contents of the element allows you to determine if you want to retrieve and work with the element.

**Follow these steps:**

1. Hover over an element you want to view.
2. Click the element to see the contents of the element.

   The contents of the element appear in the editor area.

![View an Element](images/E4E-view.gif?raw=true 'View an Element')
<br /><br />

#### View Details

The details of an element you want to view appear in the editor area in a separate tab.

**Follow these steps:**

1. Right-click on an element.
2. Select the **View Details** option.

   The details of the element appear in the editor area.

![View Details](images/E4E-view-details.gif?raw=true 'View Details')
<br /><br />

#### Retrieve an Element

You can download an element to your workspace and work with the element locally.

**Follow these steps:**

1. Right-click on an element.
2. Select the **Retrieve** option.

   The extension downloads the element and places into to your workspace. The contents of the element appear in the editor area. You can edit the element immediately. You can find the element in the workspace folder.

![Retrieve an Element](images/E4E-retrieve.gif?raw=true 'Retrieve an Element')
<br /><br />

#### Retrieve an Element with Dependencies

You can download an element with dependencies to your workspace and work with the element and the dependencies locally.

**Note**: You can retrive only a limited number of dependencies that is specified by your VS Code and Endevor configuration.

**Follow these steps:**

1. Right-click on an element.
2. Select the **Retrieve with dependencies** option.

   The extension downloads the element with dependencies and places it to your workspace. The contents of the element appear in the editor area. You can edit the element immediately. You can find the element and dependencies in the workspace folder.

![Retrieve with Dependencies](images/E4E-retrieve-dep.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

#### Edit

The **Edit** action lets you download an element, then edit and upload the element back.

**Note**: You can store your Edit elements in the temporary folder with a configurable name.

**Follow these steps:**

1. Right-click on an element.
2. Select the **Edit** option.

   The contents of the element appear in the editor area. You can edit the element.

3. Press CTLR+S or Command+S when you want to save and upload the edited element back.
4. Specify any accessible Endevor path and a name for the element.
5. Enter a CCID.
6. Enter a comment.

![Retrieve with Dependencies](images/E4E-edit.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

#### Generate

The **Generate** action creates an executable form of the element, together with any associated outputs, such as listings and the like. You can use the **Generate** option to run the CA Endevor `Generate` action for a selected element.

**Follow these steps:**

1. Right-click on an element.
2. Select the **Generate** option.

   The successful Generate call shows a pop-up with two options **Show listing** and **Cancel** and the follwing message:

   ```text
   Generate successful! Would you like to see the listing?
   ```

3. (Optional) Click **Show listing** to see the Generate output.

   Alternatively, click **Cancel**.

   **Note**: You can always review the Generate output by selecting the **Print listing** option.

If Generate is not sucessful, the listing that contains information with the exit code is displayed automatically.

#### Show listing

The **Show listing** option enables you to display the listing that was created as a result of the Generate action.

**Follow these steps**:

1. Right-click on an element.
2. Select the **Print listing** option.

   The contents of the listing appear in the editor area.

## List of Limitations

See the list of limitations that the current version of Explorer for Endevor has to familiarize yourself with possible limitations or behavior of the extension. The list includes the following points:

1. The load modules and modules without file extensions retrival is not supported.
2. Searching elements by comment and CCID is not supported.
3. Zowe CLI Secure Credential Store is not supported. If you have SCS-enabled Endevor profiles, you need to recreate the profiles to successfully use them in Explorer for Endevor.

## How to contribute

We encourage you to contribute to Explorer for Endevor.

> How can you improve Explorer for Endevor? [Open an issue in our Git repository](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)

## Eclipse Che4z

Explorer for Endevor is included with Eclipse Che version 7.6.0 and above. For more information, see the [Eclipse Che4z webpage](https://projects.eclipse.org/projects/ecd.che.che4z).

## Technical Assistance and Support for Explorer for Endevor

The Explorer for Endevor extension is made available to customers on the Visual Studio Code Marketplace in accordance with the terms and conditions contained in the provided End-User License Agreement (EULA).

If you are on active support for CA Endevor, you get technical assistance and support in accordance with the terms, guidelines, details, and parameters that are located within the Broadcom [Working with Support](https://techdocs.broadcom.com/us/product-content/admin-content/ca-support-policies.html?intcmp=footernav) guide.

This support generally includes:

- Telephone and online access to technical support
- Ability to submit new incidents 24x7x365
- 24x7x365 continuous support for Severity 1 incidents
- 24x7x365 access to CA Support Online
- Interactive remote diagnostic support

Technical support cases must be submitted to Broadcom in accordance with guidance provided in “Working with Support”.

Note: To receive technical assistance and support, you must remain compliant with “Working with Support”, be current on all applicable licensing and maintenance requirements, and maintain an environment in which all computer hardware, operating systems, and third party software associated with the affected Broadcom CA software are on the releases and version levels from the manufacturer that Broadcom designates as compatible with the software. Changes you elect to make to your operating environment could detrimentally affect the performance of Broadcom CA software and Broadcom shall not be responsible for these effects or any resulting degradation in performance of the Broadcom CA software. Severity 1 cases must be opened via telephone and elevations of lower severity incidents to Severity 1 status must be requested via telephone.

---

Copyright © 2020 Broadcom. The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
