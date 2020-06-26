<div id="header" align="center">

[![Build Status](https://ci.eclipse.org/che4z/buildStatus/icon?job=endevorExplorer%2Fdevelopment)](https://ci.eclipse.org/che4z/job/endevorExplorer/job/development/)
[![GitHub issues](https://img.shields.io/github/issues-raw/eclipse/che-che4z-explorer-for-endevor)](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)
[![slack](https://img.shields.io/badge/chat-on%20Slack-blue)](https://join.slack.com/t/che4z/shared_invite/enQtNzk0MzA4NDMzOTIwLWIzMjEwMjJlOGMxNmMyNzQ1NWZlMzkxNmQ3M2VkYWNjMmE0MGQ0MjIyZmY3MTdhZThkZDg3NGNhY2FmZTEwNzQ)

</div>

# Explorer for Endevor

Explorer for Endevor gives you the ability to Browse and Retrieve CA Endevor® SCM elements using a user-friendly, intuitive IDE interface. Explorer for Endevor allows you to create customized filters for Endevor Elements enabling you to Browse and Retrieve specific Elements, without knowing the exact path to navigate beforehand.

> How can we improve Explorer for Endevor? [Let us know on our Git repository](https://github.com/eclipse/che-che4z-explorer-for-endevor/issues)

This extension is a part of the [Che4z](https://github.com/eclipse/che-che4z) open-source project. Feel free to contribute right here.

Explorer for Endevor is also part of [Code4z](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.code4z-extension-pack), an all-round package that offers a modern experience for mainframe application developers, including [HLASM Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.hlasm-language-support), [COBOL Language Support](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.cobol-language-support), [Zowe Explorer](https://marketplace.visualstudio.com/items?itemName=Zowe.vscode-extension-for-zowe) and [Debugger for Mainframe](https://marketplace.visualstudio.com/items?itemName=broadcomMFD.debugger-for-mainframe) extensions.

## **Contents**

- [**Prerequisites**](#prerequisites)
- [**Installing**](#installing)
- [**User Guide**](#user-guide)
- [**Use Cases**](#use-cases)
- [**Configuration and Usage Tips**](#configuration-and-usage-tips)
- [**Features**](#features)
    - [**Filters**](#filters)
    - [**Elements**](#elements)
- [**Technical Assistance and Support for CA Explorer for Endevor**](#technical-assistance-and-support-for-ca-explorer-for-endevor)

## **Prerequisites**

Prior to using Explorer for Endevor, ensure that you meet the following prerequisites:

- Access to Mainframe
- Access to CA Endevor® SCM

- CA Endevor® SCM version 18.0.12 or higher with the following PTFs applied:
   - (if using version 18.0.x) PTFs SO09580, SO09581, SO10013 and SO11268
   - (if using version 18.1.x) PTF SO11272
   - (Optional) For use of Web Services with STC Pooling, ensure that you also have PTFs SO03928 and SO03929.
- CA Endevor® SCM Web Services installed and configured. For more information, see the [CA Endevor® SCM documentation](https://techdocs.broadcom.com/content/broadcom/techdocs/us/en/ca-mainframe-software/devops/ca-endevor-software-change-manager/18-1/installing/how-to-enable-web-services/configure-ca-endevor-scm-for-web-services.html)

## **Installing**

Explorer for Endevor is included with Eclipse Che version 7.6.0 and above. Check [here](https://www.eclipse.org/che/docs/che-7/introduction-to-eclipse-che/) for more information.

## **User Guide**

### **Create a Profile**

Explorer for Endevor uses Zowe CLI profiles for the CA Endevor plug-in to access Endevor inventory locations on the mainframe. If you already have a CA Endevor plug-in Zowe CLI profile, you can access inventory locations immediately through your profile in the tree. If you do not have a profile, you can create one in Explorer for Endevor. 

After you create your profile, you specify the configurations that you want to work with. This allows you to view and explore the selected Endevor repositories. You can create multiple profiles if necessary.

**Follow these steps:**

1. Click on the + icon.
2. Enter a name for your profile.
3. Enter your Endevor URL in the format `https://host:port`.
4. (Optional) To add your mainframe credentials to your profile, enter your username and password. Adding your credentials to your profile lets you access different configurations without entering your credentials.  
If you do not add credentials to your profile, a credential prompt displays whenever you click on an Endevor configuration in the tree.
5. Specify whether to Reject or Accept connections with self-signed certificates.
    - **True**: Reject connections with self-signed certificates.
    - **False**: Accept connections with self-signed certificates.
    
Your profile is now available in the panel on the left. You can also use this profile in Zowe CLI directly.

If you have multiple profiles, you might wish to delete some once you no longer need them. To do so, click on the trash can icon on the same line as the profile name.

### **Working with Endevor Configurations**

Now you have created your profile, assign the configurations that you want to work with.

**Follow these steps:**

1. Click on the profile in the panel.  
The profile automatically populates in the terminal panel.

2. To add a new configuration, click + next to the panel and select the required configuration.  
Your configuration appears in the panel below the profile entry.  
This step can be repeated as many times as you need to add multiple configurations.

You have successfully connected a profile to a configuration, and the profile is listed under Explorer for Endevor in the interface.

- You can change the name of profiles as required by clicking the pencil icon next to the profile name. Ensure that the connection name is unique.

### **Filters**

Explorer for Endevor filters can be used so that only the data you wish to work with is shown.

Filters that you create are associated with your profile. Once you log in, the stored filters are available for use.

#### **Create a Filter**

Explorer for Endevor filters can be created in two ways:

- Create a filter manually by entering all the required parameters.

- Search in Map View, and save a filter from the path followed.


#### **Create a Manual Filter:**

Creating a manual filter is a quick way to narrow down your search to only relevant results.

**Follow these steps**

1. Establish the exact parameters to search as follows:
    - Environment (env)
    - Stage Number (stgnum)
    - System (sys)
    - Subsystem (subsys)
    - Type (type)
    - Element (element)

        If you are unsure about any of the parameters, you can substitute up to two with a * wildcard, or instead create a filter using the Map View option.

2. Click the plus icon next to **Filter** on the **Explorer for Endevor** tab.

    A prompt appears for you to enter the required parameters as follows:

        - env/stgnum/sys/subsys/type/element

    If the parameters (with a maximum of two parameters as * wildcards) are correctly entered, the filter appears under the expanded Filter section in the Explorer for Endevor tab.


#### **Create a Filter in Map View:**

Map View allows you to create custom filters, without necessarily knowing the parameters in advance or if you have limited or no prior knowledge of Endevor.

**Follow these steps:**
1. Open Map View in Explorer for Endevor for your selected Host
2. Select your desired options as you navigate through the different parameters in hierarchical order.

3. Select an entry at the **Type** level, and click the plus icon.

    The path that you followed appears highlighted at the top of your screen, displaying the following dialog:

        "Create a new Endevor filter (Press 'Enter' to confirm or 'Escape' to cancel)"

4. If the created filter matches your requirements, Press Enter.

    The newly created filter is automatically saved and now shows as an option under the Filters View

### **Browse or Retrieve an Element**

The Browse Element action displays the entire contents of the Element, including related metadata. This allows you to determine if you want to retrieve and work with the Element

**Follow these steps:**

1. Right-click on the element in either the Map or Filters view.

    The options to Browse or Retrieve the Element appear.

2. Select the Browse Element option.

    The Element is displayed in the panel, including related information, as shown below:


3. Review the displayed information to determine if it is relevant or useful to you.

    You have successfully opened an element for inspection. If you wish, you can now Retrieve the Element, with or without Dependencies.

## **Use Cases**

- As a modern application developer working with CA Endevor® SCM, you use Explorer for Endevor to browse elements controlled by Endevor. You can then decide if you want to retrieve any Element into your workspace, either alone or with dependencies.

- You can use Map View in Explorer for Endevor to explore Endevor locations (Environment, Stage, System, and Subsystem) and save them as filter definitions.

- Create customised filters by including different wildcard criteria.

## **Configuration and Usage Tips**

- Delete any filters when no longer required. Filters are saved automatically and so the list might become hard to manage.

- Restrict filters to a maximum of two wildcard entries to avoid heavy resource usage. If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## **Features**:

### **Filters**

The Type level in Map View allows you to create custom filters. As these filters are derived from the properties of the specified element, they can be used, with wildcards, to identify other elements with similar characteristics.

- **Create Filter**

	Explorer for Endevor allows you to create custom filters to help you quickly identify the Elements you want to work with. You can create a filter directly by specifiying each parameter, or by searching Map View, and saving the path as a custom filter.

- **Edit Filter**

	Once created, you can edit filters to create a bespoke search for Elements with closely matching characteristics elsewhere in the data set.

- **Delete Filter**

	Created filters are saved by default. The Delete filter action helps to keep your list of created filters manageable.

### **Elements**

Once you identify the relevant Element, you can perform the following actions:

- **Browse Element**

	Displays the contents of the Element, including metadata, to help you determine if you want to Retrieve it and work with the Element.

- **Retrieve Element**

	Retrieves the Element, with no additional data. The Element is stored locally while you work with it, and you can then apply your changes.

- **Retrieve Element with Dependencies**

	Retrieves the Element and all the Endevor managed input components. The Element and components are stored locally in the specified Workspace.

- **Retrieve Multiple Elements**

	Retrieves several selected Elements. The Elements are stored locally in the specified Workspace.

For more information, please visit our [documentation](http://techdocs.broadcom.com/content/broadcom/techdocs/us/en/ca-mainframe-software/devops/ca-endevor-integrations-for-enterprise-devops/1-0/Endevor-Explorer-for-CA-Endevor-SCM.html)
---------------------------------------------------------------
### **Technical Assistance and Support for CA Explorer for Endevor**

The Explorer for Endevor extension is made available to customers on the Visual Studio Code Marketplace in accordance with the terms and conditions contained in the provided End-User License Agreement (EULA).


If you are on active support for CA Endevor, technical assistance and support is provided to Broadcom’s CA Endevor customers in accordance with the terms, guidelines, details and parameters located within Broadcom’s “Working with Support” guide located at:

https://techdocs.broadcom.com/us/product-content/admin-content/ca-support-policies.html?intcmp=footernav

This support generally includes:
- Telephone and online access to technical support
- Ability to submit new incidents 24x7x365
- 24x7x365 continuous support for Severity 1 incidents
- 24x7x365 access to CA Support Online
- Interactive remote diagnostic support

Technical support cases must be submitted to Broadcom in accordance with guidance provided in “Working with Support”.

Note: To receive technical assistance and support, you must remain compliant with “Working with Support”, be current on all applicable licensing and maintenance requirements, and maintain an environment in which all computer hardware, operating systems, and third party software associated with the affected Broadcom CA software are on the releases and version levels from the manufacturer that Broadcom designates as compatible with the software.  Changes you elect to make to your operating environment could detrimentally affect the performance of Broadcom CA software and Broadcom shall not be responsible for these effects or any resulting degradation in performance of the Broadcom CA software.  Severity 1 cases must be opened via telephone and elevations of lower severity incidents to Severity 1 status must be requested via telephone.

------------------------------------------------------------------------------------------------
Copyright © 2020 Broadcom. The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
