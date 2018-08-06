#!groovy
// Build and push docker images by branches and tags
// Required: "Basic Branch Build Strategies Plugin" and "GitHub SQS plugin"
// GitHub Behaviours: Discover tags
// GitHub Behaviours: Clean Before Checkout
// GitHub Build strategies: Regular Branches
// GitHub Build strategies: Tags
// Scan Repository Triggers Periodically  if no hooks
properties([disableConcurrentBuilds()])

def getSlackJobNameMsg () {
    return "<${env.BUILD_URL}console|#${env.BUILD_NUMBER}>"
}

def getSlackProjectNameMsg () {
    return "<${REPO_URL}/tree/${GIT_BRANCH}|${REPO_NAME}:${GIT_BRANCH}> (<${REPO_URL}/commit/${GIT_COMMIT}|${GIT_COMMIT_SHORT}>)"
}

pipeline {
    environment {
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT[0..7]}" // first 7 symbols of commit hash (because GH show only 7)
        REPO_URL = "${GIT_URL[0..-5]}" // removed postfix `.git`
        REPO_NAME = "${REPO_URL - ~/.*\//}" // removed anything before `docker-`
        IMAGE_NAME = "${REPO_NAME}" // use for readability
    }
    agent {
        label 'master'
    }
    triggers {
        githubPush()
    }
    options {
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '15'))
        timestamps()
    }
    stages {
        stage("Preparations") {
            steps {
                script {
                    slackSend channel: '#jenkins',
                        color: 'good',
                        message: "Job ${getSlackJobNameMsg()} for building ${getSlackProjectNameMsg()} started"
                }
            }
        }
        stage("Build docker image") {
            steps {
                script {
                    echo " ============== start building :latest from exodusmovement/${REPO_NAME}:${GIT_BRANCH} =================="
                    sh """
                    docker build \
                        -t exodusmovement/${IMAGE_NAME}:latest \
                        -t exodusmovement/${IMAGE_NAME}:${GIT_BRANCH} \
                        .
                    """
                    currentBuild.description = "Image built, "
                }
            }
        }
        stage("Push docker image :latest") {
            when { not { tag "*" } }
            steps {
                script {
                    echo " ============== start pushing :latest from exodusmovement/${REPO_NAME}:${GIT_BRANCH} =================="
                    withDockerRegistry([ credentialsId: "exodusmovement-docker-creds", url: "" ]) {
                        sh """
                        docker push exodusmovement/${IMAGE_NAME}:latest
                        """
                    }
                    currentBuild.description += "and pushed to registry"
                }
            }
        }
        stage("Push docker image :release") {
            when { tag "*" }
            steps {
                script {
                    echo " ============== start pushing ${GIT_BRANCH} from exodusmovement/${REPO_NAME}:${GIT_BRANCH} =================="
                    withDockerRegistry([ credentialsId: "exodusmovement-docker-creds", url: "" ]) {
                        sh """
                        docker push exodusmovement/${IMAGE_NAME}:${GIT_BRANCH}
                        """
                    }
                    currentBuild.description += "and pushed to registry"
                }
            }
        }
    }
    post {
        failure {
            slackSend channel: '#jenkins',
                color: 'danger',
                message: "Job ${getSlackJobNameMsg()} for building ${getSlackProjectNameMsg()} failed"
        }
        aborted {
            slackSend channel: '#jenkins',
                color: 'warning',
                message: "Job ${getSlackJobNameMsg()} for building ${getSlackProjectNameMsg()} aborted"
        }
        success {
            slackSend channel: '#jenkins',
                color: 'good',
                message: "Job ${getSlackJobNameMsg()} for building ${getSlackProjectNameMsg()} finished in ${currentBuild.durationString[0..-13]}"
        }
    }
}
