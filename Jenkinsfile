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
                echo "Build stage"
            }
        }
    }
}
