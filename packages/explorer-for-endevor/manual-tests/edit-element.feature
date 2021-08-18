Feature: editing an Endevor element

    Users can use the feature to modify their Endevor elements directly in VSCode.
    The chosen element will be opened in the active VSCode tab ('edit session'). Users also may choose several elements to edit.

        Background:
            Given: an Endevor service in the VSCode tree view
            And: an Endevor location in the VSCode tree view 
            And: an element in Endevor within the VSCode tree view location

        Scenario: editing an Endevor element
            When: user makes a right click on the element node in the VSCode tree view within the service & location
            And: chooses an option to edit the element
            Then: the element content should appear in the active VSCode tab
            And: the active VSCode tab with the element content can be edited

Feature: uploading the edited element changes into Endevor

    Once the editing element process is completed, users can save their changes 
    by uploading them back to Endevor and closing the 'edit session' for updated element(s).

        Background:
            Given: an edited element content is opened in the active VSCode tab
        
        Scenario: uploading an edited element content to Endevor
            When: user clicks CTRL+S/CMD+S in the keyboard
            And: fills in the upload location prefilled with the element VSCode tree view location
            And: fills in the action CCID+Comment prefilled with the element VSCode tree view location
            Then: the element content should be uploaded into Endevor within the specified upload location & action CCID+Comment
        
        Scenario: resolving conflicts between the edited element versions during the upload process
            Given: the element content updated in the Endevor upload location
            When: user clicks CTRL+S/CMD+S in the keyboard
            And: fills in the upload location prefilled with the element VSCode tree view location
            And: fills in the action CCID+Comment prefilled with the element VSCode tree view location
            Then: the VSCode diff editor should appear in the active VSCode tab near to the element 'edit session' tab
            And: the VSCode diff editor should contain ability to modify the local version of the element
            And: the VSCode diff editor should contain ability to accept the local version of the element and upload it into Endevor
            And: the VSCode diff editor should contain ability to dicard the local version of the element and close the element 'edit session'
            And: the VSCode diff editor should contain ability to be closed to continue working in the element 'edit session'

        # Can be a general error case for now to check keeping the element 'edit session' opened
        Scenario: keeping the element 'edit session' opened in case of incorrect upload location specified
            When: user clicks CTRL+S/CMD+S in the keyboard
            But: fills in the incorrect upload location
            And: fills in the action CCID+Comment prefilled with the element VSCode tree view location
            Then: the element 'edit session' should stay opened

Feature: comparing the local & remote versions of the Endevor element
    
    Users can use the feature to see the differences between local and remote version of the Endevor element.
    The remote version will be opened in read-only mode on the left side,
    while the local version will be available to modify on the right side of the VSCode diff editor.

        Background: 
            Given: a VSCode diff editor is opened in the active VSCode tab near to the element 'edit session' tab

        Scenario: accepting the local element version changes
            When: user modifies the local element version in the VSCode diff editor
            And: chooses an option to accept the local element version to upload
            Then: the local version of the element should be uploaded into the specified Endevor location
            And: the VSCode diff editor should be closed
            And: the element 'edit session' should be closed

        Scenario: discarding the local element version changes
            When: user chooses an option to discard the local element version changes
            Then: the VSCode diff editor should be closed
            And: the element 'edit session' should be closed

        Scenario: closing the VSCode diff editor
            When: user closes the VSCode diff editor
            Then: the VSCode diff editor should be closed
            And: the element 'edit session' should stay opened

        Scenario: showing a new VSCode diff editor in case of the repeated element version conflicts during the acception of the local changes
            Given: the element content updated again in the Endevor upload location
            When: user modifies the local element version in the VSCode diff editor
            And: chooses an option to accept the local element version to upload
            Then: the VSCode diff editor should be closed
            And: a new VScode diff editor should be opened with updated remote & local versions of the element
            And: the element 'edit session' should stay opened

        # Can be a general error case for now to check keeping the diff editor opened
        Scenario: keeping the VSCode diff editor opened in case of 'not in SIGN-OUT error' during the acception of the local changes
            Given: the element is not in the SIGN-OUT state in the Endevor
            When: user modifies the local element version in the VSCode diff editor
            And: chooses an option to accept the local element version to upload
            Then: the VSCode diff editor should stay opened
            And: the element 'edit session' should stay opened
