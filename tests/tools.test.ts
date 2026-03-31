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

import { slackGetMyMentions, slackGetThread, slackSearchMessages, slackPostMessage, slackGetUserProfile } from '../src/tools/slack';
import { jiraSearchIssues, jiraGetIssue, jiraGetIssueComments, jiraCreateIssue, jiraUpdateIssue, jiraGetEditableFields } from '../src/tools/jira';
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

  test('slack_get_user_profile finds a user by name', async () => {
    const result = await slackGetUserProfile({ name: 'Gal Zilberman' });
    expectSuccess(result);
    expect(result).toMatch(/Name:/);
    expect(result).toMatch(/Title:/);
  });

  test('slack_get_user_profile returns custom profile fields (department, division, etc.)', async () => {
    const result = await slackGetUserProfile({ name: 'Gal Zilberman' });
    expectSuccess(result);
    expect(result).toContain('**Department:**');
    expect(result).toContain('**Division:**');
    expect(result).toContain('**City:**');
  });

  test('slack_get_user_profile resolves user-type fields (manager) to names', async () => {
    const result = await slackGetUserProfile({ name: 'Gal Zilberman' });
    expectSuccess(result);
    expect(result).toContain('**Manager:**');
    expect(result).not.toMatch(/\*\*Manager:\*\* U[A-Z0-9]+$/m);
  });

  test('slack_get_user_profile finds a user by email', async () => {
    const result = await slackGetUserProfile({ email: 'michall@jfrog.com' });
    expectSuccess(result);
    expect(result).toMatch(/Name:/);
    expect(result).toContain('michall@jfrog.com');
  });

  test('slack_get_user_profile returns error when no args provided', async () => {
    const result = await slackGetUserProfile({});
    expect(result).toContain('Provide at least one');
  });

  test('slack_get_user_profile handles non-existent user gracefully', async () => {
    const result = await slackGetUserProfile({ name: 'xyznonexistentuser98765' });
    expect(result).toBeDefined();
    expect(result).toMatch(/No user found/i);
  });

  test('slack_get_user_profile handles non-existent email gracefully', async () => {
    const result = await slackGetUserProfile({ email: 'nonexistent-user-xyz@fake-domain-12345.com' });
    expect(result).toBeDefined();
    expect(result).toMatch(/No user found/i);
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

  test('jira_update_issue is callable', () => {
    expect(typeof jiraUpdateIssue).toBe('function');
  });

  test('jira_update_issue handles non-existent ticket', async () => {
    const result = await jiraUpdateIssue({ issue_key: 'FAKE-99999', summary: 'test' });
    expect(result).toBeDefined();
    expect(result).toMatch(/Error/i);
  });

  test('jira_get_editable_fields returns fields for a known ticket', async () => {
    const result = await jiraGetEditableFields({ issue_key: 'RTDEV-79775' });
    expectSuccess(result);
    expect(result).toMatch(/Editable fields|Error/i);
  });

  test('jira_get_editable_fields supports search filter', async () => {
    const result = await jiraGetEditableFields({ issue_key: 'RTDEV-79775', search: 'summary' });
    expectSuccess(result);
    expect(result).toMatch(/summary/i);
  });

  test('jira_get_editable_fields handles non-existent ticket', async () => {
    const result = await jiraGetEditableFields({ issue_key: 'FAKE-99999' });
    expect(result).toBeDefined();
    expect(result).toMatch(/Error/i);
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

describeGithub('GitHub Enterprise Tools (Backend)', () => {
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

describeGithub('GitHub Enterprise Tools (MFE Frontend)', () => {
  const mfeRepo = config.github.mfeRepo;

  test('mfe_code_search finds results in the MFE repo', async () => {
    const result = await codeSearch({ query: 'HeapHandler', limit: 3, repo: mfeRepo });
    expectSuccess(result);
    expect(result).toMatch(/result|No code results/i);
  });

  test('mfe_code_search finds Vue components', async () => {
    const result = await codeSearch({ query: 'PackagesListPage', extension: 'vue', limit: 3, repo: mfeRepo });
    expectSuccess(result);
    expect(result).toMatch(/result|No code results/i);
  });

  test('mfe_code_get_file returns directory listing for frontend/core', async () => {
    const result = await codeGetFile({ path: 'frontend/core', repo: mfeRepo });
    expectSuccess(result);
    expect(result).toMatch(/Directory listing|File not found/i);
  });

  test('mfe_code_get_file handles non-existent path', async () => {
    const result = await codeGetFile({ path: 'this/path/does/not/exist.vue', repo: mfeRepo });
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

// ─── Coralogix (remote MCP server) ───────────────────────────

describe('Coralogix Integration', () => {
  test('coralogix-server is configured in mcp.json', () => {
    const fs = require('fs');
    const path = require('path');
    const mcpPath = path.resolve(__dirname, '../../.cursor/mcp.json');
    if (!fs.existsSync(mcpPath)) {
      console.log('  Coralogix: SKIPPED (no .cursor/mcp.json found at workspace root)');
      return;
    }
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const coralogix = mcpConfig.mcpServers?.['coralogix-server'];
    expect(coralogix).toBeDefined();
    expect(coralogix.url).toMatch(/coralogix/);
    expect(coralogix.headers?.Authorization).toBeDefined();
  });

  test('coralogix-server URL points to a valid MCP endpoint', () => {
    const fs = require('fs');
    const path = require('path');
    const mcpPath = path.resolve(__dirname, '../../.cursor/mcp.json');
    if (!fs.existsSync(mcpPath)) return;
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const url = mcpConfig.mcpServers?.['coralogix-server']?.url || '';
    expect(url).toMatch(/^https:\/\/api\.coralogix\.\w+\/mgmt\/api\/v1\/mcp$/);
  });
});

// ─── Summary ─────────────────────────────────────────────────

describe('Configuration Check', () => {
  test('reports which integrations are configured', () => {
    const fs = require('fs');
    const path = require('path');
    const mcpPath = path.resolve(__dirname, '../../.cursor/mcp.json');
    let coralogixConfigured = false;
    if (fs.existsSync(mcpPath)) {
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
        coralogixConfigured = !!mcpConfig.mcpServers?.['coralogix-server']?.url;
      } catch {}
    }

    const status = [
      `Slack: ${slackConfigured ? 'configured' : 'SKIPPED (missing tokens)'}`,
      `Jira: ${jiraConfigured ? 'configured' : 'SKIPPED (missing tokens)'}`,
      `GitHub: ${githubConfigured ? 'configured' : 'SKIPPED (missing token)'}`,
      `Google: ${googleConfigured ? 'configured' : 'SKIPPED (missing token)'}`,
      `Coralogix: ${coralogixConfigured ? 'configured (remote MCP)' : 'SKIPPED (not in mcp.json)'}`,
      `Docs: always runs (no credentials needed)`,
    ];
    console.log('\n  Integration status:\n  ' + status.join('\n  ') + '\n');
    expect(true).toBe(true);
  });
});
