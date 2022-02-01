Feature: support both password and passphrase

    Users can use a password (6-8 chars and case insensitive) or a passphrase (9-100 chars and case sensitive)

        Scenario:
            When: user provdies a password (6-8 chars) or a passphrase (9-100 chars) in endevor profile
            Then: user can see and navigate elements in the VSCode tree view

        Scenario:
            Given: User has not provided password in profile
            When: user attempts to add location profile
            And: user is prompted for password
            And: user provides short (6-8 case insensitive) or long (9-100 case sensitive) password
            Then: user can see and navigate their elements tree
