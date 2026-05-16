pipeline {
    agent any

    stages {
        // state build
        stage('Build') {
            agent{
                docker{
                    image 'node:18-alpine'
                    reuseNode true
                }
            }
            steps {
                steps{
                    sh '''
                    echo "Build stage"
                    node --version
                    npm --version
                    npm ci
                    '''
                }
            }
        }
    }
}
