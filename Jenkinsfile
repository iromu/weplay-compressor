pipeline {
    agent none

    triggers {
      upstream(upstreamProjects: "weplay-common/" + env.BRANCH_NAME.replaceAll("/", "%2F"), threshold: hudson.model.Result.SUCCESS)
    }

    stages  {

        stage('Initialize') {
         agent { label 'node'  }
          steps {
            script {
              def node = tool name: 'Node-8.4.0', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
              env.PATH = "${node}/bin:${env.PATH}"
            }
            sh 'node -v'
            sh 'yarn install'
          }
        }

       stage('Build'){
         agent { label 'node'  }
         steps {
            sh 'yarn build'
         }
       }

       stage('Test'){
         agent { label 'node'  }
         steps {
            sh 'yarn plato'
            sh 'jenkins-mocha --compilers js:babel-register --cobertura test/*.spec.js'
            junit 'artifacts/test/xunit.xml'
         }
       }

       stage('Archive'){
         agent { label 'node'  }
         steps {
            sh 'yarn pack'
            archiveArtifacts '*.tgz'
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: true, reportDir: 'report/plato', reportFiles: 'index.html', reportName: 'Plato Report', reportTitles: ''])
         }
       }

       stage('Docker arm'){
         agent { label 'arm'  }
         steps {
             sh 'docker build --no-cache -t iromu/weplay-compressor-arm:latest . -f Dockerfile_arm'
             sh 'docker push iromu/weplay-compressor-arm:latest'
         }
       }

       stage('Docker amd64'){
         agent { label 'docker'  }
         steps {
             sh 'docker build --no-cache -t iromu/weplay-compressor:latest . -f Dockerfile'
             sh 'docker push iromu/weplay-compressor:latest'
         }
        }

       stage('Cleanup'){
         agent any
         steps {
            cleanWs()
         }
       }

    }
}
