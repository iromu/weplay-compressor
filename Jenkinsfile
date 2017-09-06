pipeline {
    agent any

    stages  {

        stage('Initialize') {
          steps {
            script {
              def node = tool name: 'Node-8.4.0', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
              env.PATH = "${node}/bin:${env.PATH}"
            }
            sh 'node -v'
            sh 'yarn install'
            sh 'yarn link weplay-common'
          }
        }

       stage('Build'){
         steps {
            sh 'yarn build'
         }
       }

       stage('Test'){
         steps {
            sh 'yarn plato'
            sh 'yarn ci-test'
            junit 'artifacts/test/xunit.xml'
         }
       }

       stage('Archive'){
         steps {
            sh 'yarn link'
            sh 'yarn pack'
            archiveArtifacts '*.tgz'
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: true, reportDir: 'report/plato', reportFiles: 'index.html', reportName: 'Plato Report', reportTitles: ''])
         }
       }

       stage('Cleanup'){
         steps {
            cleanWs()
         }
       }

    }
}
