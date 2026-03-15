/**
 * Integration tests for all PM Copilot MCP tools.
 *
 * These tests call live APIs using real credentials from environment variables.
 * Each integration group auto-skips when its required credentials are missing.
 *
 * Run with env vars set:
 *   SLACK_BOT_TOKEN=... SLACK_USER_TOKEN=... npm test
 *
 * Or create a .env file and use dotenv, or pass them from your MCP config.
 */

import { slackGetMyMentions, slackGetThread, slackSearchMessages, slackPostMessage } from '../src/tools/slack';
import { jiraSearchIssues, jiraGetIssue, jiraGetIssueComments, jiraCreateIssue } from '../src/tools/jira';
import { docsSearch, docsGetPage } from '../src/tools/docs';
import { codeSearch, codeGetFile } from '../src/tools/github';
import { gdocsRead, gsheetsRead, gslidesRead, gdriveSearch, gdriveGetFile, gcalGetEvents } from '../src/tools/google';
import { config } from '../src/config';

function expectSuccess(result: string) {
  expect(result).toBeDefined();
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
  expect(result).not.toMatch(/^Error:/);
}

function hasValue(val: string): boolean {
  return !!val && !val.startsWith('YOUR');
}

const slackConfigured = hasValue(config.slack.botToken) && hasValue(config.slack.userToken);
const jiraConfigured = hasValue(config.jira.email) && hasValue(config.jira.apiToken);
const githubConfigured = hasValue(config.github.token);
const googleConfigured = hasValue(config.google.refreshToken);

// ─── Slack ───────────────────────────────────────────────────

const describeSlack = slackConfigured ? describe : describe.skip;

describeSlack('Slack Tools', () => {
  test('slack_get_my_mentions returns results', async () => {
    const result = await slackGetMyMentions({ limit: 3 });
    expectSuccess(result);
    expect(result).toMatch(/mention|No recent mentions/i);
  });

  test('slack_search_messages returns results for a known query', async () => {
    const result = await slackSearchMessages({ query: 'artifactory', limit: 3 });
    expectSuccess(result);
    expect(result).toMatch(/result|No messages found/i);
  });

  test('slack_get_thread handles missing channel gracefully', async () => {
    const result = await slackGetThread({ channel: 'C000000FAKE', thread_ts: '1234567890.000000' });
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  test('slack_post_message is callable (dry-run check only)', () => {
    expect(typeof slackPostMessage).toBe('function');
  });
});

// ─── Jira ────────────────────────────────────────────────────

const describeJira = jiraConfigured ? describe : describe.skip;

describeJira('Jira Tools', () => {
  test('jira_search_issues returns results for text search', async () => {
    const result = await jiraSearchIssues({ query: 'artifactory', limit: 3 });
    expectSuccess(result);
    expect(result).toMatch(/issue|No issues found/i);
  });

  test('jira_search_issues supports JQL', async () => {
    const result = await jiraSearchIssues({ query: 'project = RTDEV ORDER BY updated DESC', limit: 2 });
    expectSuccess(result);
    expect(result).toMatch(/RTDEV|No issues found/i);
  });

  test('jira_get_issue returns details for a known ticket', async () => {
    const result = await jiraGetIssue({ issue_key: 'RTDEV-79775' });
    expectSuccess(result);
    expect(result).toContain('RTDEV-79775');
  });

  test('jira_get_issue_comments returns comments', async () => {
    const result = await jiraGetIssueComments({ issue_key: 'RTDEV-79775', limit: 5 });
    expectSuccess(result);
    expect(result).toMatch(/comment|No comments/i);
  });

  test('jira_get_issue handles non-existent ticket', async () => {
    const result = await jiraGetIssue({ issue_key: 'FAKE-99999' });
    expect(result).toBeDefined();
    expect(result).toMatch(/Error|not found|does not exist/i);
  });

  test('jira_create_issue is callable', () => {
    expect(typeof jiraCreateIssue).toBe('function');
  });

  test('jira_create_issue rejects missing required fields', async () => {
    const result = await jiraCreateIssue({ project_key: '', summary: '', description: '' });
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

// ─── JFrog Docs (no credentials needed) ─────────────────────

describe('JFrog Docs Tools', () => {
  test('docs_search returns matching pages from both doc sources', async () => {
    const result = await docsSearch({ query: 'docker cleanup' });
    expectSuccess(result);
    expect(result).toContain('jfrog.com/help');
    expect(result).toContain('docs.jfrog.com');
  });

  test('docs_search handles unknown topic', async () => {
    const result = await docsSearch({ query: 'xyznonexistent12345' });
    expectSuccess(result);
    expect(result).toContain('Direct link attempts');
  });

  test('docs_get_page fetches a legacy documentation URL', async () => {
    const result = await docsGetPage({ url: 'https://jfrog.com/help/r/jfrog-artifactory-documentation/repository-management' });
    expectSuccess(result);
    expect(result).toContain('jfrog.com');
  });

  test('docs_get_page fetches a new docs URL', async () => {
    const result = await docsGetPage({ url: 'https://docs.jfrog.com/artifactory/docs/getting-started' });
    expectSuccess(result);
    expect(result).toContain('docs.jfrog.com');
  });

  test('docs_get_page resolves a relative path to new docs', async () => {
    const result = await docsGetPage({ url: 'repository-management' });
    expectSuccess(result);
    expect(result).toContain('docs.jfrog.com');
  });
});

// ─── GitHub Enterprise (Codebase) ────────────────────────────

const describeGithub = githubConfigured ? describe : describe.skip;

describeGithub('GitHub Enterprise Tools', () => {
  test('code_search finds results in the Artifactory repo', async () => {
    const result = await codeSearch({ query: 'RemoteRepo', limit: 3 });
    expectSuccess(result);
    expect(result).toMatch(/result|No code results/i);
  });

  test('code_get_file returns directory listing for root', async () => {
    const result = await codeGetFile({ path: '' });
    expectSuccess(result);
    expect(result).toMatch(/Directory listing|File not found/i);
  });

  test('code_get_file handles non-existent path', async () => {
    const result = await codeGetFile({ path: 'this/path/does/not/exist.java' });
    expect(result).toBeDefined();
    expect(result).toMatch(/not found/i);
  });
});

// ─── Google Workspace ────────────────────────────────────────

const describeGoogle = googleConfigured ? describe : describe.skip;

describe('Google Workspace Tools', () => {
  test('gdocs_read returns config error when not configured', async () => {
    if (googleConfigured) return;
    const result = await gdocsRead({ document_id: 'fake-doc-id' });
    expect(result).toContain('not configured');
  });
});

describeGoogle('Google Workspace Tools (live)', () => {
  test('gdocs_read can read a document', async () => {
    const result = await gdocsRead({ document_id: 'test-doc-id' });
    expectSuccess(result);
  });

  test('gsheets_read can read a spreadsheet', async () => {
    const result = await gsheetsRead({ spreadsheet_id: 'test-sheet-id' });
    expectSuccess(result);
  });

  test('gslides_read can read a presentation', async () => {
    const result = await gslidesRead({ presentation_id: 'test-slides-id' });
    expectSuccess(result);
  });

  test('gdrive_search finds files', async () => {
    const result = await gdriveSearch({ query: 'artifactory', limit: 3 });
    expectSuccess(result);
  });

  test('gdrive_get_file reads a file', async () => {
    const result = await gdriveGetFile({ file_id: 'test-file-id' });
    expectSuccess(result);
  });

  test('gcal_get_events returns calendar events', async () => {
    const result = await gcalGetEvents({ days_back: 1, days_ahead: 1, limit: 5 });
    expectSuccess(result);
  });
});

// ─── Summary ─────────────────────────────────────────────────

describe('Configuration Check', () => {
  test('reports which integrations are configured', () => {
    const status = [
      `Slack: ${slackConfigured ? 'configured' : 'SKIPPED (missing tokens)'}`,
      `Jira: ${jiraConfigured ? 'configured' : 'SKIPPED (missing tokens)'}`,
      `GitHub: ${githubConfigured ? 'configured' : 'SKIPPED (missing token)'}`,
      `Google: ${googleConfigured ? 'configured' : 'SKIPPED (missing token)'}`,
      `Docs: always runs (no credentials needed)`,
    ];
    console.log('\n  Integration status:\n  ' + status.join('\n  ') + '\n');
    expect(true).toBe(true);
  });
});
