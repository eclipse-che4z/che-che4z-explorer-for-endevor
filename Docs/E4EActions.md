## Explorer for Endevor Actions

Explorer for Endevor enables you to explore Endevor using custom filters. You can then inspect and retrieve elements from data sets to work with, before merging your changes with the data source.

### Filter Actions

Create Filters to further refine your search for elements in Explorer in Endevor.
The Type level allows you to create custom filters.
The created filters are derived from the properties of the specified element.
As such, they can be used, with wildcards, to identify other elements of similar characteristics.

#### Create Filter

Filters can be created in two ways. You can create a filter manually by entering all the required parameters, or you can search in Map View, and save a filter from the path you followed.

#### Create a Manual Filter:
You can create a manual filter if you know the exact parameters required.
#### Follow these steps:
1. Click the plus icon next to Filter on the Explorer for Endevor tab.
2. When prompted, enter the required parameters as follows:
    - Environment (env)
    - Stage Number (stgnum)
    - System (sys)
    - Subsystem (subsys)
    - Type (type)
    - Element (element)
  If the parameters (with a maximum of two parameters as * wildcards) are correctly entered, the filter will appear under the expanded Filter section in the Explorer for Endevor tab.

#### Create a Filter through Map View:
The Type level in Map View allows you to create custom filters, without necessarily knowing the parameters in advance.
#### Follow these steps:
1. Open Map View in Explorer for Endevor for your selected Host
2. Navigate the view as required, selecting your desired options as you navigate through the following stages:
    - Repository
    - Environment
    - Stage Number
    - System
    - Subsystem
    - Type
3. Select an entry at the Type level, and click the Add icon.
  The path that you followed appears highlighted at the top of your screen, displaying the following dialog:
4. Create a new Endevor filter (Press 'Enter' to confirm or 'Escape' to cancel)
5. If the created filter matches your requirements, Press Enter.
  The newly created filter is automatically saved and now shows as an option under the Filters View 

  Once created, you can then edit or delete the filter as required.

#### Edit Filter
You can edit existing filters to create custom searches for elements with closely matching characteristics elsewhere in the data set.
#### Follow these steps:
1. Select the filter that you want to edit. The filter is highlighted, and the following options are displayed:
    - Delete
    - Edit
2. Click the edit icon. A message shows with the instruction "Edit filter. (Press 'Enter' to confirm or 'Escape' to cancel)" and the selected filter highlighted with only the Element field as a Wildcard ( * ):
- ENVIRONMENT/STAGE NUMBER/SYSTEM/SUBSYSTEM/TYPE/*
3. Replace any field as required with a Wildcard ( * ), for example:
- ENVIRONMENT/STAGENUMBER/SYSTEM/SUBSYSTEM/*/*

  This filter could now be used, for example, to display all Types and Elements in the specified Subsystem 
4. Press Enter to confirm the changes
  The filter has been edited and now shows under the list of saved filters.
The filters list automatically contains every filter that you have created and so it can get heavily populated if you are conducting several different searches. To address this, delete filters once they are no longer needed.
#### Notes:
    - Wildcard entries or specific data must be entered for every level when a filter is edited.
    - Filters with missing or empty fields are not permitted.
    - Filters that you create are automatically saved in the Filters View.
    - You can key several fields as wildcards, however ensure that you use no more than two wildcards in any filter.
    - If searching in a large volume of data using several wildcards can trigger large scale searches, with a negative impact on performance.

#### Delete Filter
The filters list automatically contains every filter that you have created and so it can get heavily populated if you are conducting several different searches. To address this, you can delete filters once they are no longer needed
#### Follow these steps:
1. Select the filter that you want to delete The filter is highlighted, and the following options are displayed:
    - Delete
    - Edit
2. Click the Delete icon.
A message shows as follows:
Delete filter: ENV1/1/( * )/( * )/( * )/( * )?
Source: Explorer for Endevor (Extension) 
3. Click OK The filter is deleted.

### Explorer for Endevor Element Actions

Once you identify the relevant data, you can perform the following actions:
- Browse Element

  Displays the contents of the Element, including metadata, to help you determine if you want to retrieve and work with the Element.
- Retrieve Element

  Retrieves the Element, with no additional data. The Element is stored locally while you work with it, and you can then apply your changes.
- Retrieve Element with Dependencies

  Retrieves the Element, with additional information highlighting any other elements or processes that use the element in its current state. The Element is stored locally while it is worked on, before you then upload it back to the main repository.
- Retrieve Multiple Elements

  Retrieves the several selected Elements, with no additional data. The Elements are stored locally while being worked on, before you then upload them back to the main repository.

#### Browse Element

#### Retrieve Element

#### Retrieve Element with Dependencies

#### Retrieve Multiple Elements
