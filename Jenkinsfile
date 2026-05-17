pipeline {
    agent any

    stages {
        // Install dependencies
        stage('Install dependencies') {
            agent{
                docker{
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh '''
                    node --version
                    npm --version
                    npm ci
                '''
            }
        }

        // Static code analysis stages
        stage('ESLint'){
            agent{
                docker{
                    image 'node:20-alpine'
                    reuseNode true
                }
            }

            steps{
                sh 'npm run lint'
            }
        }

        // Unit tests stages
        stage('Unit tests'){
            agent{
                docker{
                    image 'node:20-alpine'
                    reuseNode true
                }
            }

            steps{
                sh '''
                npm run test:coverage
                ls -la
                '''
            }
        }

    }
    post{
        success{
            publishHTML([allowMissing: false, 
                alwaysLinkToLastBuild: false, 
                icon: '', 
                keepAll: false, 
                reportDir: 'coverage\\lcov-report\\', 
                reportFiles: 'index.html', 
                reportName: 'Unit Test Raport', 
                reportTitles: 'Unit Test Raport', 
                useWrapperFileDirectly: true])
        }
    }
}
