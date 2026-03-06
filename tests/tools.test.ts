/**
 * Integration tests for all PM Copilot MCP tools.
 *
 * These tests call live APIs using real credentials from environment variables.
 * Run with: npm test
 *
 * Google Workspace tests are skipped when GOOGLE_REFRESH_TOKEN is not configured.
 * slack_post_message is tested with a dry-run assertion (no actual message posted).
 */

import { slackGetMyMentions, slackGetThread, slackSearchMessages, slackPostMessage } from '../src/tools/slack';
import { jiraSearchIssues, jiraGetIssue, jiraGetIssueComments } from '../src/tools/jira';
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

// ─── Slack ───────────────────────────────────────────────────

describe('Slack Tools', () => {
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

describe('Jira Tools', () => {
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
});

// ─── JFrog Docs ──────────────────────────────────────────────

describe('JFrog Docs Tools', () => {
  test('docs_search returns matching pages for known topic', async () => {
    const result = await docsSearch({ query: 'docker cleanup' });
    expectSuccess(result);
    expect(result).toContain('jfrog.com');
  });

  test('docs_search handles unknown topic', async () => {
    const result = await docsSearch({ query: 'xyznonexistent12345' });
    expectSuccess(result);
    expect(result).toContain('Direct link attempt');
  });

  test('docs_get_page fetches a known documentation URL', async () => {
    const result = await docsGetPage({ url: 'https://jfrog.com/help/r/jfrog-artifactory-documentation/repository-management' });
    expectSuccess(result);
    expect(result).toContain('jfrog.com');
  });
});

// ─── GitHub Enterprise (Codebase) ────────────────────────────

describe('GitHub Enterprise Tools', () => {
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

const googleConfigured = config.google.refreshToken && !config.google.refreshToken.startsWith('YOUR');

describe('Google Workspace Tools', () => {

  const skipOrRun = googleConfigured ? test : test.skip;

  test('gdocs_read returns config error when not configured', async () => {
    if (googleConfigured) return;
    const result = await gdocsRead({ document_id: 'fake-doc-id' });
    expect(result).toContain('not configured');
  });

  skipOrRun('gdocs_read can read a document', async () => {
    const result = await gdocsRead({ document_id: 'test-doc-id' });
    expectSuccess(result);
  });

  skipOrRun('gsheets_read can read a spreadsheet', async () => {
    const result = await gsheetsRead({ spreadsheet_id: 'test-sheet-id' });
    expectSuccess(result);
  });

  skipOrRun('gslides_read can read a presentation', async () => {
    const result = await gslidesRead({ presentation_id: 'test-slides-id' });
    expectSuccess(result);
  });

  skipOrRun('gdrive_search finds files', async () => {
    const result = await gdriveSearch({ query: 'artifactory', limit: 3 });
    expectSuccess(result);
  });

  skipOrRun('gdrive_get_file reads a file', async () => {
    const result = await gdriveGetFile({ file_id: 'test-file-id' });
    expectSuccess(result);
  });

  skipOrRun('gcal_get_events returns calendar events', async () => {
    const result = await gcalGetEvents({ days_back: 1, days_ahead: 1, limit: 5 });
    expectSuccess(result);
  });
});
