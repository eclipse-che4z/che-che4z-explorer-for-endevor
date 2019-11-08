#!groovy

node('nodeo') {
   // delete workspace
   deleteDir()
    
   // Mark the code checkout 'stage'....
   stage('Checkout') {
      // Checkout code from repository
      checkout scm
   }

   def commit_msg = sh (script: "git log -1 --pretty=%s", returnStdout: true).trim()
   def commit_author = sh (script: "git log -1 --pretty=format:'%an'", returnStdout: true).trim()
   def branchName = env.JOB_BASE_NAME
   def sonarBranchTarget = "development"

   if ("${branchName}" == "development") {
      sonarBranchTarget = "master"
   }

   currentBuild.description = commit_author + ": " + commit_msg

   stage('Install') {
      sh 'npm install'
   }

   stage('SonarQube analysis') {
         // requires SonarQube Scanner 2.8+
        def scannerHome = tool 'SonarQ scanner';
        withSonarQubeEnv('sonarqube-isl-01.ca.com') {
            sh "${scannerHome}/bin/sonar-scanner  -Dsonar.projectKey=com.broadcom.endevor-explorer-ts -Dsonar.branch.target=${sonarBranchTarget} -Dsonar.branch.name=${branchName}"
        }
   }

   stage('Compile') {
      sh 'tsc -p ./'
   }

   def version = ""
	stage('Version') {
      sh "node -e \"console.log(require('./package.json').version)\" > extensionVersion"
      def extversion = readFile("./extensionVersion").trim()
      echo "extension version: ${extversion}"
      version = extversion + "+" + BUILD_NUMBER + "." + new Date().format("ddMMyy", TimeZone.getTimeZone('UTC'))
      echo "build version: ${version}"      
	}

   stage('Build') {
      sh 'vsce package'
      sh "mv explorer-for-endevor-*.vsix explorer-for-endevor-${version}.vsix"
      archiveArtifacts '*.vsix'
   }

   if ("${branchName}" == "development") {
      stage ('Upload to Artifactory') {
         // Create 'latest' artifact
         sh 'cp explorer-for-endevor-*.vsix explorer-for-endevor-latest.vsix'
         // Obtain an Artifactory server instance, defined in Jenkins --> Manage:
         server = Artifactory.server 'Test_Artifactory'
         // Configure upload of artifact
         def uploadSpec = """{
            "files": [
               {
                  "pattern": "explorer-for-endevor*.vsix",
                  "target": "local-files/endevor-explorer/"
               }
            ]
         }"""
         server.upload spec: uploadSpec
      }

    stage ('Trigger Red Button') {
      build(
        job: '/RedButton/RedButton',
        parameters: [
          string(name: 'Che_Theia_tag', value: '7.0.0-rc-4.0'),
          string(name: 'Tag', value: 'latest'),
          booleanParam(name: 'zOS_Explorer', value: true),
          string(name: 'zOS_Explorer_version', value: 'latest'),
          booleanParam(name: 'Endevor_Explorer', value: true),
          string(name: 'Endevor_Explorer_version', value: 'latest'),
          booleanParam(name: 'Cobol_LSP', value: true),
          string(name: 'Cobol_LSP_version', value: 'latest'),
          booleanParam(name: 'HLASM_LSP', value: true),
          string(name: 'HLASM_LSP_version', value: 'latest'),
          string(name: 'Stack_type', value: 'Docker'),
          string(name: 'Che_server_URL', value: 'http://czprapd-chewie.mcl.broadcom.net:8989')
        ],
        wait: false
      )
    }
  }

}
