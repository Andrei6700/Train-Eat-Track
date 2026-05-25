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
            tools{
                gradle 'Gradle'
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
        // Temporarily disabled due to Gradle build daemon disappeared unexpectedly
        // stage('Build Android') {
        //     agent{
        //         docker{
        //             image 'reactnativecommunity/react-native-android'
        //             reuseNode true
        //         }
        //     }
        //     steps {
        //         sh '''
        //         npx expo prebuild --platform android
        //         cd android
        //         ./gradlew assembleRelease --max-workers=2 --no-daemon
        //         '''
        //     }
        // }

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
