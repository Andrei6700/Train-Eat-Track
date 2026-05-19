pipeline {
    agent any

    stages {
        // Install dependencies
        stage('Install dependencies') {
            agent{
                docker{
                    image 'reactnativecommunity/react-native-android'
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

        // Build Android
        stage('Build Android') {
            agent{
                docker{
                    image 'reactnativecommunity/react-native-android'
                    reuseNode true
                }
            }
            tools{
                gradle 'Gradle'
            }
            steps {
                sh '''
                npx expo prebuild --platform android
                '''
            }
        }

        // Static code analysis stages
        stage('ESLint'){
            agent{
                docker{
                    image 'reactnativecommunity/react-native-android'
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
                    image 'reactnativecommunity/react-native-android'
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
