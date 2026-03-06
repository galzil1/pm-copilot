export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    userToken: process.env.SLACK_USER_TOKEN || '',
  },
  jira: {
    host: process.env.JIRA_HOST || 'https://jfrog-int.atlassian.net',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
  },
  github: {
    url: process.env.GITHUB_ENTERPRISE_URL || 'https://github.jfrog.info',
    token: process.env.GITHUB_ENTERPRISE_TOKEN || '',
    repo: process.env.ARTIFACTORY_REPO || 'JFROG/artifactory-service',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  },
};
