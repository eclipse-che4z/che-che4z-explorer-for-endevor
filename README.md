# Explorer for Endevor <!-- omit in toc -->

<div id="header" align="center">

[![Build Status](https://ci.eclipse.org/che4z/buildStatus/icon?job=endevorExplorer%2Fdevelopment)](https://ci.eclipse.org/che4z/job/endevorExplorer/job/master/)
[![GitHub issues](https://img.shields.io/github/issues-raw/eclipse/che-che4z-explorer-for-endevor)](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://join.slack.com/t/che4z/shared_invite/zt-22b0064vn-nBh~Fs9Fl47Prp5ItWOLWw)

</div>

The Explorer for Endevor VS Code extension modernizes the way you interact with Endevor and offers a user-friendly and convenient way to work with elements and inventory locations. Explorer for Endevor includes the following features:

- Work with multiple Endevor inventory locations
- Filter elements in the **Endevor Elements** view
- Fetch elements from up the Endevor map
- Add an element
- View an element
- Edit an element
- Move an element
- Retrieve an element with dependencies
- Create a package
- Cast and reset a package
- List and filter packages
- View element details
- View history of elements
- View the element diff in element history
- Check action reports
- Perform a Generate action
- Print a listing
- Read team configuration files and Zowe CLI profiles (including Zowe base profiles)
- Create and synchronize an Endevor workspace
- Leverage a basic SCL highlighter

Explorer for Endevor is a part of the [Che4z](https://github.com/eclipse/che-che4z) open-source project. The extension is also part of [Code4z](https://techdocs.broadcom.com/code4z), an all-round VS Code extension package that offers a modern experience for mainframe application developers, including tools for language support, data editing, testing, and source code management. For an interactive overview of Code4z, see the [Code4z Developer Cockpit](https://mainframe.broadcom.com/code4z-developer-cockpit).

## Table of Contents <!-- omit in toc -->

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Get Started Walkthroughs](#get-started-walkthroughs)
  - [Create an Endevor Connection](#create-an-endevor-connection)
  - [Create an Endevor Inventory Location](#create-an-endevor-inventory-location)
- [Token Authentication and PassTickets](#token-authentication-and-passtickets)
- [Workspace Synchronization](#workspace-synchronization)
- [Use Cases](#use-cases)
- [Base Profiles](#base-profiles)
  - [Access Zowe API Mediation Layer](#access-zowe-api-mediation-layer)
- [Team Configuration File](#team-configuration-file)
- [Reports View](#reports-view)
- [Packages View](#packages-view)
- [Manage the Extension Tree](#manage-the-extension-tree)
- [Configure Explorer for Endevor](#configure-explorer-for-endevor)
- [List of Limitations](#list-of-limitations)
- [Contribute to Explorer for Endevor](#contribute-to-explorer-for-endevor)
- [Eclipse Che4z](#eclipse-che4z)
- [Zowe Conformance Program](#zowe-conformance-program)
- [Privacy Notice](#privacy-notice)
- [Technical Assistance and Support for Explorer for Endevor](#technical-assistance-and-support-for-explorer-for-endevor)

## Prerequisites

Ensure that you meet the following prerequisites before you use Explorer for Endevor:

**Client-side prerequisites**:

- Access to Endevor.
- Visual Studio Code version 1.58 or higher.

**Host-side prerequisites**:

- Endevor 18.0.12 or higher:

  - (Endevor 18.0.12) Install PTF SO09580.
  - (Endevor 18.1) Install PTF SO09581.
  - (Endevor 19.0)

- Endevor Web Services.

## Getting Started

Create an Endevor connection and Endevor inventory location and review use cases to see how you can use the full potential of Explorer for Endevor. Alternatively, use your existing Zowe CLI Endevor profiles to get started.

Explorer for Endevor 1.7.0 includes the following new features and changes:

- Create, cast, and reset a package for multiple elements.

- Select the processor group before uploading an edited element back to Endevor.

- Split the element save and element upload functionalities. Now you can make changes in the element and choose when to upload the element back to Endevor.

- The default profiles from the team config files, if present, are now propagated to the top of the Endevor Elements view at the beginning of the Explorer for Endevor session.

With the 1.6.0 release, Explorer for Endevor introduces a number of features that further improve user experience.

- The **Move** command enables you to move (promote) elements one stage up the map.

- Report View tracks the session activity and provides the Execution and API reports.

- Ability to connect to API Mediation Layer (ML) and take advantage of microservices using your base profile.

- Ability to specify a processor group when you add or generate an element.

- Ability to view important information including available processor groups, definition details, and last action CCID by hovering over the Endevor location, element types, and elements.

### Get Started Walkthroughs

VS Code enables you to review walkthroughs to get started with Explorer for Endevor. The walkthrough contains short guides that help you get familiar with the extension features.

1. Click **Help** in the menu bar.

2. Select **Get Started** from the drop-down menu.

3. Select the **Get Started with Explorer for Explorer** walkthrough or click **More...** to select the walkthrough if it is not displayed immediately.

4. Select a feature that you want to discover.

### Create an Endevor Connection

Create an Endevor connection.

1. Click the **Add a New Endevor Connection** button to add an Endevor connection.

   Alternatively, select your existing Endevor connections.

2. Select **Create a new Endevor Connection**.
3. Enter a name for your connection.
4. Enter your [Endevor Web Services URL](https://techdocs.broadcom.com/us/en/ca-mainframe-software/devops/ca-endevor-software-change-manager/18-0/installing/how-to-enable-web-services/install-and-set-up-ca-endevor-scm-web-services/validate-web-services.html) in the `http(s)://host:port/basePath` format.

   - Depending on the Endevor connections you use, you can include `EndevorService/api/v1`, `EndevorService/rest` or `EndevorService/api/v2` in `basePath`. If `basePath` is omitted, the default is `EndevorService/api/v2`.
   - Explorer for Endevor checks if the specified URL is accessible. If not, you are prompted to either change the specified value or proceed without changing the value.
   - You might be prompted to either accept or reject connections with self-signed certificates if the extension encounters an issue with the server certificate issuer validation in the connection testing phase. If no issues are found, the prompt does not appear and the value is set to `reject`.

5. (Optional) Enter your username and password to add your mainframe credentials to the connection.

   Adding your credentials to your connection enables you to access different inventory locations without the need to enter your credentials more than once.

   **Notes**:

   - If your connection does not include credentials during the first session of Explorer for Endevor, you are prompted to enter credentials.
   - Passwords with 9 or more characters are treated as a _passphrase_ by the server and are case-sensitive.

Your new connection is now available in the Endevor Elements view.

### Create an Endevor Inventory Location

Once you have an Endevor connection, you need to add an inventory location. An inventory location consists of an Endevor instance, Endevor path with environment, system, subsystem, stage number, element type, CCID, and Comment. Inventory locations enable you to view and work with elements of specified Endevor locations.

1. Click the **+** icon next to your Endevor connection to add a new inventory location.
2. Create a name for the inventory location and press Enter.
3. Select an instance from the drop-down menu and press Enter.
4. Enter the Endevor path and press Enter.

   The path has the `environment/stagenumber/system/subsystem/type` format.

   **Notes**:

   - If you are unsure about the system, subsystem, or type parameters, you can substitute any of these parameters with a `\*` wildcard.
   - The elements search function is executed with the `Build using map` Endevor list option.

5. (Optional) Enter CCID and press Enter.
6. (Optional) Enter a comment and press Enter.

   - If you want to skip the CCID and/or comment step, you can leave the inputs blank by pressing Enter.
   - You can cancel the creation of Endevor inventory location at any step by pressing Escape.

You successfully created an inventory location.

## Token Authentication and PassTickets

The Explorer for Endevor Token Authentication feature attempts to use temporary tokens (PassTickets) that are generated by the Endevor Authentication to sign on to the Endevor Web Services. The feature is enabled by default. You can disable the feature, using the **Use Token Authentication** option in the extension settings.

**Note:** If the token support is not configured on the Endevor Web Services or the **Use Token Authentication** setting is disabled, a basic authentication with username and password is used instead.

For more information on PassTickets, check the [Multi-Factor Authentication (MFA)](https://techdocs.broadcom.com/us/en/ca-mainframe-software/devops/ca-endevor-software-change-manager/18-0/securing/multi-factor-authentication-mfa.html) in the Endevor documentation.

## Workspace Synchronization

A synchronized Endevor workspace enables you to work with inventory locations locally and synchronize elements from and to Endevor on the mainframe. You can create an Endevor workspace in your VS Code by enabling the **Workspace Sync** setting in the extension settings. Synchronized elements appear in the selected folder and you can see them in the **File Explorer** panel. You can manage the workspace from VS Code with Explorer for Endevor extension installed.

**Note:** The feature is experimental in Explorer for Endevor v1.3.0, v1.4.0 and v1.5.0.

For more information on the setting, see [Configure Explorer for Endevor](#configure-explorer-for-endevor) in this Readme.

To learn more about the Endevor Workspace synchronization feature, read [this article](https://medium.com/modern-mainframe/editing-synchronized-endevor-elements-locally-ff096d09eb5e) on Medium or review [the extension walkthroughs](#get-started-walkthroughs) in VS Code.

## Use Cases

Review the following use cases to familiarize yourself with the basic Explorer for Endevor features:

- [Filter elements](#filter-elements): Filter one or multiple elements by names or last action CCID.
- [Fetch elements from up the Endevor map](#fetch-elements-from-up-the-map): Fetch the first found elements from up the Endevor map.
- [Add an element](#add-an-element): Upload an element from your workstation to a chosen Endevor inventory location.
- [View an element](#view-an-element): View the contents, summary report, and source level information of the selected element.
- [Move an element](#move-an-element): Move an element up the map by using the Endevor `move statement` with such options as **With History**, **Bypass Element Delete**, **Synchronize**, **Retain Signout**, and **Jump**.
- [View details](#view-details): View the details of a chosen element. The details include the environment, stage, system, subsystem, element type, and the name and extension of the element.
- [Show history](#show-history): Review the history of a selected element.
- [Generate all elements for a subsystem](#generate-all-elements-for-a-subsystem):
  Generate the elements that are allocated in place in the selected subsystem, using a proper type sequence. Additionally, produce a detailed report that contains build status.
- [Review the Generate report](#review-the-Generate-report): Review the C1MSGS1 Endevor batch execution report that is available to you once the **Generate in Place** or **Generate with Copyback** function is executed.
- [Retrieve an element](#retrieve-an-element): Download the selected element.
- [Retrieve an element with dependencies](#retrieve-an-element-with-dependencies): You can download the selected element with dependencies.
- [Create a package](#create-a-package): You can create a package from multiple elements.
- [Show packages](#show-packages): Show packages from an Endevor instance.
- [Filter packages](#filter-packages): Filter one or multiple packages by their status.
- [Cast a package](#cast-a-package): You can cast a package using various cast options.
- [Reset a package](#reset-a-package): The Reset action enables you to reset package back to the IN-EDIT status.
- [Edit](#edit): The Edit action enables you to download an element to your workspace, edit, and upload the selected element step by step. Once you are done with editing the element, press CTRL+S or Command+S to upload the edited element back.
- [Generate](#generate): Call the Generate action for an element to invoke the Generate Processor that creates an executable form of the element.
- [Print a listing](#print-a-listing): Reveal the output of the performed Generate action.
- [Sign out](#sign-out): Lock an Endevor element so that the element is only editable by you.
- [Sign in](#sign-in): Let you unlock a locked element. You can only unlock the elements that were locked by you.

### Filter Elements

You apply a filter or multiple filters to the Endevor elements that were fetched into the **Endevor Elements** view. Filters enable you to display the specified elements only.

1. Hover over an inventory location in the **Endevor Elements** view.

   The **Filter an Inventory Location** icon appears on the right side of the panel.

2. Click the **Filter an Inventory Location** icon to set a filter for one or more elements.

   The dialog with the following options appears:

   - Select the **By Element Name** option.

     The Explorer dialog appears. Type a name(s) to filter by. Use a comma to separate multiple values.

   - Select the **By Type** option.

     The Explorer dialog appears. Enter a type pattern to filter by. Use a comma to separate multiple values.

   - Select the **By Element Last Action CCID** option.

     The Explorer dialog appears. Type a last action CCID to filter by. Use a comma to separate multiple values.

3. Press Enter to confirm your choice.

   A **Filtered** row appears in the **Endevor Elements** view. You can expand the row to see what filters are applied to the inventory location.

4. (Optional) Edit or remove your filters by clicking the **Edit filter** or **Clear filter value** options respectively. The options appear when you hover over the filter names.

![Filter Elements](images/E4E-filter-elements.gif?raw=true 'Filter Elements')
<br /><br />

You successfully set a filter for your inventory location.

### Fetch Elements from up the Map

Both **Build using map** and **Return first found** Endevor search element options are combined to fetch first found elements from up the map into the **Endevor Elements** view.

1. Hover over an inventory location in the **Endevor Elements** view.

   The **Show Endevor elements from up the map** icon appears on the right side of the panel.

2. Click the **Show Endevor elements from up the map** icon.

   The elements from up the Endevor map appear in the **Endevor Elements** view.

3. (Optional) You can switch back to the elements from the inventory location only view by clicking the **Show Endevor elements in place**.

![Show Endevor Elements from up the Map](images/E4E-up-the-map.gif?raw=true 'Show Endevor Elements from up the Map')
<br /><br />

You successfully fetched the elements from up the map.

### Add an Element

You can upload a new element to your inventory location. Also, you can assign a processor group to your element in the process of uploading the element. The uploaded element appears under the selected type in the **Endevor Elements** view.

1. Hover over an inventory location in the **Endevor Elements** view.

   The **Add an Element** icon appears on the right side of the panel.

2. Click the **Add an Element** icon to upload a new element.

   The Explorer dialog appears. You can now select an element that you want to upload from your workstation.

3. Select an element that you want to upload from your workstation.

4. (Optional) Select an available processor group from the drop-down list.

![Add an Element](images/E4E-add.gif?raw=true 'Add an Element')
<br /><br />

You successfully added the element.

### View an Element

You can view the contents, summary, and source level information of an element by clicking on the element in the **Endevor Elements** view. The chosen element appears in the editor area. Viewing the contents of the element allows you to determine if you want to retrieve and work with the element.

1. Hover over an element that you want to view.
2. Click the element to see the contents of the element.

   The contents of the element appear in the editor area.

![View an Element](images/E4E-view.gif?raw=true 'View an Element')
<br /><br />

### Move an Element

Use the **Move** option against an element to move the selected element up the map. When the move is successful, the element is displayed in the next stage up the map. To see the result of the move, click the **Show Endevor Elements Up The Map** option that fetches the elements from up the map into the **Endevor Elements** view. By default, the up the map view is not enabled.

1. (Optional) Hover over your environment location in the **Endevor Elements** view and click the **Show Endevor Elements Up The Map** option.

   The up the map elements display in the **Endevor Elements** view.

2. Right-click the element you want to move and select the **Move** option.

3. Enter the CCID.

4. Enter the comment.

5. (Optional) Select the following **Move** options:

   - **With History**: The option preserves source element change history. If you move the element without history, Endevor searches through the element levels at the source location to find a matching level at the target location. Endevor then compares the two and creates a new level at the target location that reflects the differences.
   - **Bypass Element Delete**: Retains the element in the source stage after the move.
   - **Synchronize**: Compensates for differences between the base level of a source element and the current level of a target element. If differences are found, Endevor compares the two elements and creates a new level at the target that reflects the differences. If Endevor differences are not found, Endevor proceeds with a regular move action.
   - **Retain Signout**: The moved element retains the source location signout at the target location.
   - **Jump**: Moves an element even if the element exists at an intermediate stage, not on the map.

You successfully moved the element up the map.

### View Details

The inventory location details of an element you want to view appear in the editor area in a separate tab.

1. Right-click an element.
2. Select the **View Details** option.

   The details of the element appear in the editor area.

![View Details](images/E4E-view-details.gif?raw=true 'View Details')
<br /><br />

### Show History

The **Show History** feature enables you to review changes of the element. You can see a new view that is called **Element History** under the explorer tree. The view lists the history of changes for a selected element.

1. Right-click an element.
2. Select the **Show History** option.

   The history of the element appears in the editor area.

![View History](images/E4E-view-history.gif?raw=true 'View History=')
<br /><br />

### Review the Generate Report

You can retrieve the C1MSGS1 Endevor batch execution report that contains the detailed information of your generated elements.

1. Right-click an element.
2. Select the **Generate in Place** or **Generate with Copyback** option.
3. Enter CCID.
4. Enter a comment.
5. Click the **Show Report** button in the pop-up.

   The C1MSGS1 Endevor batch execution report appears in the editor area.

![View History](images/E4E-report-after-actions.gif?raw=true 'View History=')
<br /><br />

### Generate All Elements for a Subsystem

- **Generate All Elements** enables you to generate all the elements within a subsystem.

1. Hover over a subsystem.
2. Click the **Generate All Elements** icon.
3. Enter CCID.
4. Enter a comment.

   The summary table for a C1MSGS1 Endevor batch execution report is produced in the event of error(s) while generating element(s). You can review the table in the editor area.

![Report Table](images/E4E-report-table-generate.gif?raw=true 'Report Table')
<br /><br />

### Retrieve an Element

You can download an element to your workspace and work with the element locally.

1. Right-click an element.
2. Select the **Retrieve** option.

   The extension downloads and places the element into your workspace. The contents of the element appear in the editor area. You can find the element in the workspace folder.

You successfully retrieved the element.

![Retrieve an Element](images/E4E-retrieve.gif?raw=true 'Retrieve an Element')
<br /><br />

### Retrieve an Element with Dependencies

You can download an element with dependencies to your workspace and work with the element and the dependencies locally.

1. Right-click an element.
2. Select the **Retrieve with dependencies** option.

   The extension downloads and places the element with dependencies into your workspace. The contents of the element appear in the editor area.

You successfully retrieved the element with dependencies.

![Retrieve with Dependencies](images/E4E-retrieve-dep.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

### Create a Package

Create a package from multiple elements. Select elements that you want to organize in a package and right-click on the selection to select the **Create Package** option.

1. Select an element or an array of elements by holding the **CTRL/Command** key and using the left mouse button.
2. Right-click the selected element(s) and select the **Create Package** option.
3. Enter a name for the package.
4. Enter a description for the package.
5. Select options for the package.
6. (Optional) Enter a CCID.
7. (Optional) Enter a comment.
8. Select **Move** command options for the package.

You successfully created the package.

You can find the package in the **Endevor Packages** view.

![Create a Package](images/E4E-create-package.gif?raw=true 'Create a package')

<br /><br />

### Show packages

Use the following ways to show packages from an Endevor instance.

- Select an Endevor instance from the **Endevor Packages** view:

  1. Hover over the **Endevor Packages** view toolbar and click **Change Instance**.
  2. Select connection and configuration.
  3. (Optional) Select a package status filter.

- Use **Show Packages** from the **Endevor Element** view:

  1. Right-click the Endevor inventory location in the **Endevor Element** view.
  2. Select the **Show Packages** option.
  3. (Optional) Select a package status filter.

You successfully displayed the packages.

### Filter Packages

You can apply a status filter when listing packages in the Endevor instance for the first time. The filter reduces the number of packages that are pulled from Endevor based on the status.

1. Right-click the filter icon at the top of the list in the **Endevor Element** view and select the **Change Filter** option.

2. Select a status you want to filter.

   **Note:** If all statuses are selected, no packages are filtered out.

You successfully applied a filter to the listed packages.

### Cast a Package

Use the **Cast** option against a package to prepare the package for review and subsequent execution.

1. Right-click the package you want to cast and select the **Cast Package** option.

2. (Optional) Select the following **Cast** options:

   - **Backout Enabled**: Indicates whether the backout facility is available for the selected package.
   - **Components Validation** (radio group):
     - **Validate**: Enables component validation. If component validation fails, the cast fails, as well.
     - **Do not validate**: Disables component validation for the package.
     - **(Default) Validate with warnings**: Enables component validation and generates a warning if component validation fails.

You successfully cast the package. You should see a notification pop-up with the **Show Execution Report** and **Cancel** options and the following message:

```text
Cast package ... using configuration ... was successful. Would you like to see the report?
```

If the cast of the package fails, the execution report is displayed automatically.

### Reset a Package

Use the **Reset** option against a package if you want to set status back to **In-edit**, which enables you to modify the package. You can use the **Reset** option against any package status type.

1. Right-click a package.
2. Select the **Reset Package** option.

You successfully performed the **Reset Package** action.

### Edit

The **Edit** action lets you download an element, edit, and upload the element back.

1. Right-click an element.
2. Select the **Edit** option.

   The contents of the element appear in the editor area. You can now edit the element.

3. Press **CTLR+S** or **Command+S** when you want to save the edited element.
4. Specify any accessible Endevor path and a name for the element.
5. Enter a CCID.
6. Enter a comment.
7. (Optional) Resolve conflicts between the element versions if necessary.

   **Notes:**

   - The behavior of the conflict resolution feature differs in Theia.

   - (Theia only) When you resolve a conflict, open the Command Palette by pressing **CTRL+SHIFT+P** or **CMD+SHIFT+P** and use one of the following commands: `Accept changes` or `Discard changes`.

You successfully edited and saved the element.

![Retrieve with Dependencies](images/E4E-edit.gif?raw=true 'Retrieve with Dependencies')
<br /><br />

### Generate

The **Generate** action enables you to select a processor group and create an executable form of the element, together with any associated outputs such as listings, and has the following available options:

- **Generate in Place** enables you to generate the selected element in the same location where the element resides.

- **Generate with Copyback** enables you to copy the selected element back from up the map to the target location first and then generate the element in that location.

- **Generate with No Source** enables you to generate an element in the target location, using the source of the selected element from up the map. In this case, the source is not fetched to the target location and the sourceless element is created.

You can use the **Generate in Place**, **Generate with Copyback**, or **Generate with No Source** context menu options to perform the Endevor Generate action for a selected element.

1. Select one of the following options:

   - Right-click an element and select the **Generate in Place** option.

     ![Generate in Place](images/E4E-Generate-in-Place.gif?raw=true 'Generate in Place')
     <br /><br />

   - Right-click an element from up the map and select the **Generate with Copy back** option.

     ![Generate with Copy back](images/E4E-Generate-Copyback.gif?raw=true 'Generate with Copy back')
     <br /><br />

   - Right-click an element from up the map and select the **Generate with No Source** option.

   A successfully-performed Generate action shows a notification pop-up with the **Print a listing** and **Cancel** options and the following message:

   ```text
   Successfully generated the elements: ... Would you like to see the listing?
   ```

2. (Optional) Select an available processor group from the drop-down list.

3. (Optional) Click **Print a listing** to see the Generate output.

   **Note**: You can always review the Generate output by selecting the **Print a listing** option.

You successfully performed the Generate action.

If Generate fails to process an element, the listing is displayed automatically.

### Print a Listing

The **Print a listing** option enables you to display the most recently created listing.

1. Right-click an element.
2. Select the **Print a listing** option.

   The contents of the listing appear in the editor area.

You successfully printed the listing.

![Print Listing](images/E4E-Print-Listing.gif?raw=true 'Print Listing')
<br /><br />

### Sign Out

The **Sign out** option enables you to lock an element, which prevents other users from editing the element.

1. Right-click an element.
2. Select the **Sign out** option.
3. Enter a CCID.
4. Enter a comment.

You successfully signed out the element.

![Sign Out](images/E4E-signout.gif?raw=true 'Sign Out')
<br /><br />

### Sign In

The **Sign in** option enables you to unlock an element that earlier was signed out by you.

1. Right-click an element.
2. Select the **Sign in** option.

You successfully signed in the element.

## Base Profiles

Explorer for Endevor enables you to use Zowe CLI base profiles. To make your default base profile work in the extension, ensure that you specify such parameters as username, password, host, port, and `rejectUnauthorized` in the base profile. For more information about how base profiles work, see [the Base Profile](https://docs.zowe.org/stable/user-guide/cli-using-using-profiles/#base-profiles) section on Zowe Docs.

### Access Zowe API Mediation Layer

The extension enables you to connect to Endevor Web Services that are integrated with the Zowe API Mediation Layer, using your existing base profile. Ensure that you log in to the Zowe API Mediation layer authentication service, using your credentials and edit your current Endevor location to include the API ML endpoint for Endevor Web Services.

1. Navigate to Zowe Explorer.

2. Right-click your profile in the Data Sets view and select the **Manage Profile** option.

3. Select the **Edit Profile** option from the drop-down menu.

   A team configuration file is opened.

4. Add a new Endevor connection with the following properties:

   ```json
   {
     "$schema": "./zowe.schema.json",
     "profiles": {
       "base": {
         "type": "base",
         "properties": {
           "host": "api-ml-service.net", // specify your base URL for the Zowe API Mediation Layer
           "port": 8080, // specify the port of your Zowe API Mediation Layer
           "rejectUnauthorized": true,
           "tokenType": "apimlAuthenticationToken"
         },
         "secure": ["tokenValue"]
       },
       "endevor-via-apiml": {
         "type": "endevor",
         "properties": {
           "basePath": "/endevor/api/v2" // Specify the basePath of your Endevor Web Services integrated with the Zowe API Mediation Layer
         }
       }
     }
   }
   ```

   where `host` and `port` are the common endpoint of your Zowe API ML services, and `basePath` is the specific endpoint where your Endevor Web Services are deployed under the Zowe API ML.

5. Save your team configuration file.

For more information about Zowe API Mediation Layer, see [Integrating with API Mediation Layer](https://docs.zowe.org/stable/user-guide/cli-using-integrating-apiml/) on Zowe Docs.

You successfully customized the API ML connection properties for your Endevor connection.

## Team Configuration File

Explorer for Endevor supports reading a global team configuration (team config) file. A team configuration file enables you to manage your Endevor connection details efficiently in one location. You can use global team configs with your team members to share access to Endevor inventory locations. For more information about team config, see [Using Team Profiles](https://docs.zowe.org/stable/user-guide/cli-using-using-team-profiles) on Zowe Docs. The extension reads team configuration files only if the profile sync setting is enabled. To configure the setting, navigate to > **Settings** > **Extensions** > **Explorer for Endevor** > **Profiles: Keep in sync**.

As an application developer, you can obtain a shared global configuration file from your system administrator and use the file to access shared systems. As a system administrator, you need to have [Zowe CLI 7.2.1](https://docs.zowe.org/stable/user-guide/cli-installcli) or higher on your workstation before you create a team configuration file.

> **Tip**: You can convert your existing Zowe CLI profiles into team configuration files with the `zowe config convert-profiles` command. For more information about team config conversion, see [Using Profiles](https://docs.zowe.org/stable/user-guide/cli-using-using-profiles/#important-information-about-team-profiles) on Zowe Docs.

## Reports View

The extension enables you to monitor activity of the session in the Explorer for Endevor tab that you can access using the View tab. The Reports View feature helps you troubleshoot any errors that occur in the extension more efficiently.

Use Reports View to keep track of events that happen during an active session of the extension and review execution errors or API notification messages.

1. Navigate to the **View** tab in VS Code.

2. Click **Command Palette...**.

   The command prompt is displayed.

3. Type **Explorer for Endevor: Focus on Endevor Reports View** and press Enter.

The Report View is displayed.

You can now click on events to expand them and access execution or API error reports.

To see a list of Endevor messages and codes that were reported, hover over records of the warning or error messages.

## Packages View

The extension enables you to see the Endevor packages in a specified Endevor instance, to filter the packages and perform package-related actions.

You can perform the following actions to change the way packages are displayed and the order in which they are displayed:

- **Show Packages Created by User**: Click on the **Show Packages Created by User** icon in the **Endevor Packages** view toolbar to show only packages created by currently logged in user.

- **Descending/Ascending Order by Package ID**: Click on the **Descending/Ascending Order by Package ID** icon to toggle the order in which packages are shown.

- **Change Instance**: Click on the **Change Instance** icon to change the Endevor instance whose packages are displayed.

- **Refresh Endevor Packages**: Click on the **Refresh Endevor Packages** icon to retrieve packages information from Endevor, using the current Endevor instance and filter.

## Manage the Extension Tree

You can perform the following actions to manage your connections and inventory locations in the extension tree:

- **Delete a connection**: Delete your connection permanently by right-clicking a connection node and selecting the **Delete a connection** option.

- **Delete an inventory location**: Delete your inventory location permanently by right-clicking an inventory location node and selecting the **Delete an inventory location** option.

- **Hide a connection**: If you do not want to list your connections in the **Endevor Elements** view, you can hide such connections. To hide a connection, right-click the connection node and select the **Hide a connection** option.

- **Hide an inventory location**: If you do not want to list your inventory locations in the **Endevor Elements** view, you can hide such locations. To hide an inventory location, right-click the location node and select the **Hide an inventory location** option.

- **Edit an Endevor Connection**: Edit your Endevor connection login details by right-clicking a connection node and selecting the **Edit an Endevor Connection** option.

  **Note:** The **Hide a connection** or **Hide an inventory location** actions do not permanently delete the information from the extension.

## Configure Explorer for Endevor

You can configure the following settings of the extension:

- The number of parallel HTTP requests supported by Endevor.

- Automatic Signout. The signout function locks elements for you. If the option is enabled, retrieved or edited elements are signed out to you. If an element is signed out to somebody else, a notification asking whether to override the signout pops up. If the option is disabled, the extension retrieves or edits an element without signout.

- Telemetry level. You can disable or configure data that is collected by Telemetry in the VS Code Settings. Navigate to **Settings** > **Application** > **Telemetry** > **Telemetry Level** to do so. For more information, see [Disable Telemetry](https://code.visualstudio.com/docs/getstarted/telemetry#_disable-telemetry-reporting) in the VS Code documentation.

  **Note:** This setting applies not only to Explorer for Endevor but to all extensions in your VS Code.

- Profiles: Keep in Sync. The option enables you to use a team configuration file that stores your pre-saved Endevor configuration or Zowe CLI Endevor profiles with Endevor locations in the extension. By default, the setting is enabled, meaning that the extension reads your team configuration files on startup and displays profile information in the **Endevor Elements** view. If the option is disabled, the extension does not check the `.zowe` folder for available profiles.

  **Notes**:

  - You can use Endevor connections and inventory locations that are created in Explorer for Endevor in the extension only.

- File extension resolution. The option enables you to choose between the following methods of file extension resolution for the locally saved elements.

  - 'Element name only' method uses the element name to determine the file extension.

  - 'Endevor type file extension only' method uses the Endevor defined file extension for the type.

  - (Default) 'Endevor type file extension or type name' method uses the Endevor defined file extension for the type. The method also uses the Endevor type name as a fall-back option.

- (Experimental) Workspace Synchronization. The option enables the Endevor Workspace initialization that lets you create a synchronized Endevor workspace locally.

  **Note:** Experimental features might include undiscovered errors. Please, use this feature at your own discretion.

- Ask for Processor Group. The option enables selection of a processor group when you perform Generate, Add, or Upload actions. A selected processor group overrides the previously chosen processor group.

- Generate Subsystem. The option enables the extension to add the Generate all Elements feature. The option is disabled by default. Once enabled, the feature appears in the **Endevor Elements** view. You can then perform the Generate all Elements action against a susbystem node.

- The editor auto save setting is disabled by default.

  **Note**: Using the auto save feature with Explorer for Endevor might result in a bad user experience.

  To change the setting, navigate to the VS Code Settings and look for **Files: Auto Save**.

Access the Explorer for Endevor settings by clicking **Settings** > **Extensions** > **Explorer for Endevor**.

## List of Limitations

This section lists notable limitations in the current version of Explorer for Endevor.

- Searching elements by comment and CCID is not supported.

  You can search using the instance, environment, stageNumber, system, subsystem, and type parameters.

- Only the UTF-8 character encoding is currently supported.

## Contribute to Explorer for Endevor

We encourage you to share ideas to help improve Explorer for Endevor. You can also report issues in the extension, using the following link.

> [Share an idea or open an issue in our Git repository](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)

## Eclipse Che4z

Explorer for Endevor is included with Eclipse Che version 7.6.0 and above. For more information, see the [Eclipse Che4z webpage](https://projects.eclipse.org/projects/ecd.che.che4z).

## Zowe Conformance Program

<a href="https://www.openmainframeproject.org/all-projects/zowe/conformance"><img src="images/zowe-conformant.png" alt="Zowe Conformance Badge" width="200" height="160"/></a>

Explorer for Endevor is Zowe V2 Conformant. The Zowe Conformance Program ensures a high level of common functionality, interoperability, and user experience while using an extension that leverages Zowe. For more information, see [Zowe Conformance Program](https://www.openmainframeproject.org/all-projects/zowe/conformance).

## Privacy Notice

The extensions for Visual Studio Code developed by Broadcom Inc., including its corporate affiliates and subsidiaries, ("Broadcom") are provided free of charge, but in order to better understand and meet its users’ needs, Broadcom may collect, use, analyze and retain anonymous users’ metadata and interaction data, (collectively, “Usage Data”) and aggregate such Usage Data with similar Usage Data of other Broadcom customers. Please find more detailed information in [License and Service Terms & Repository](https://www.broadcom.com/company/legal/licensing).

This data collection uses built-in Microsoft VS Code Telemetry, which can be disabled, at your sole discretion, if you do not want to send Usage Data.

The current release of Explorer for Endevor collects anonymous data for the following events:

- Extension commands, such as Add, Retrieve, Sign in, Sign out, Edit, Generate, etc.
- Build the **Endevor Elements** view, refresh the view
- Filter elements
- Internal and Endevor errors

**Note**: Any sensitive information is filtered, so the extension gets only anonymous error messages and Endevor REST API error codes. The Endevor REST API error codes are collected for the purposes of determining errors in the extension lifecycle.

Each such event is logged with the following information:

- Event time
- Operating system and version
- Country or region
- Anonymous user and session ID
- Version numbers of Microsoft VS Code and Explorer for Endevor

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

Copyright © 2024 Broadcom. The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
