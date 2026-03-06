#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  slackGetMyMentions,
  slackGetThread,
  slackSearchMessages,
  slackPostMessage,
} from './tools/slack';

import {
  jiraSearchIssues,
  jiraGetIssue,
  jiraGetIssueComments,
} from './tools/jira';

import {
  docsSearch,
  docsGetPage,
} from './tools/docs';

import {
  codeSearch,
  codeGetFile,
} from './tools/github';

import {
  gdocsRead,
  gsheetsRead,
  gslidesRead,
  gdriveSearch,
  gdriveGetFile,
  gcalGetEvents,
} from './tools/google';

const server = new Server(
  { name: 'pm-copilot', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'slack_get_my_mentions',
    description: 'Fetch recent Slack messages where you are mentioned. Use this to see what people are asking you.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max messages to return (default 20)' },
      },
    },
  },
  {
    name: 'slack_get_thread',
    description: 'Get the full conversation thread from a Slack channel. Provide channel ID and thread timestamp to retrieve all replies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Slack channel ID (e.g. C01ABC2DEF3)' },
        thread_ts: { type: 'string', description: 'Thread timestamp (e.g. 1234567890.123456)' },
        limit: { type: 'number', description: 'Max messages to return (default 50)' },
      },
      required: ['channel', 'thread_ts'],
    },
  },
  {
    name: 'slack_search_messages',
    description: 'Search Slack messages by keyword or query. Supports Slack search modifiers like "from:user", "in:channel", "has:link", date ranges, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (supports Slack search syntax)' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'slack_post_message',
    description: 'Post a message to a Slack channel or thread. IMPORTANT: Only use this after the user has explicitly approved the message content.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', description: 'Slack channel ID to post to' },
        text: { type: 'string', description: 'Message text to post' },
        thread_ts: { type: 'string', description: 'Thread timestamp to reply in (omit for new message)' },
      },
      required: ['channel', 'text'],
    },
  },
  {
    name: 'jira_search_issues',
    description: 'Search Jira issues by keyword or JQL query. Automatically detects if the input is JQL or a plain text search.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query - plain text or JQL (e.g. "project = RTFACT AND status = Open")' },
        limit: { type: 'number', description: 'Max results to return (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'jira_get_issue',
    description: 'Get full details of a specific Jira issue including description and latest comments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        issue_key: { type: 'string', description: 'Jira issue key (e.g. RTFACT-12345)' },
      },
      required: ['issue_key'],
    },
  },
  {
    name: 'jira_get_issue_comments',
    description: 'Get all comments on a specific Jira issue. Useful for understanding discussion history and decisions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        issue_key: { type: 'string', description: 'Jira issue key (e.g. RTFACT-12345)' },
        limit: { type: 'number', description: 'Max comments to return (default 30)' },
      },
      required: ['issue_key'],
    },
  },
  {
    name: 'docs_search',
    description: 'Search JFrog official documentation for Artifactory features, configuration, REST APIs, best practices, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (e.g. "remote repository replication", "Docker cleanup policy")' },
        limit: { type: 'number', description: 'Max results to return (default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'docs_get_page',
    description: 'Fetch and read a specific JFrog documentation page. Provide a full URL or a path relative to the docs base.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL or path to a JFrog docs page' },
      },
      required: ['url'],
    },
  },
  {
    name: 'code_search',
    description: 'Search the Artifactory codebase (artifactory-service repo) for code, classes, methods, or configurations.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Code search query (e.g. "RemoteCacheCleanup", "replication retry")' },
        path: { type: 'string', description: 'Limit search to a path (e.g. "backend/core/src")' },
        extension: { type: 'string', description: 'Limit to file extension (e.g. "java", "groovy")' },
        limit: { type: 'number', description: 'Max results to return (default 15)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'code_get_file',
    description: 'Fetch a specific file or directory listing from the Artifactory codebase.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path in the repo (e.g. "backend/core/src/main/java/.../RemoteRepo.java")' },
        ref: { type: 'string', description: 'Git ref - branch, tag, or commit SHA (default: main branch)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'gdocs_read',
    description: 'Read a Google Doc and return its content as text/markdown. Accepts a document URL or ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        document_id: { type: 'string', description: 'Google Docs URL or document ID (e.g. "https://docs.google.com/document/d/1ABC.../edit" or just "1ABC...")' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'gsheets_read',
    description: 'Read a Google Sheets spreadsheet. Can read a specific range or the full sheet.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        spreadsheet_id: { type: 'string', description: 'Google Sheets URL or spreadsheet ID' },
        range: { type: 'string', description: 'Optional range (e.g. "Sheet1!A1:D10"). Omit to read all sheets.' },
      },
      required: ['spreadsheet_id'],
    },
  },
  {
    name: 'gslides_read',
    description: 'Read a Google Slides presentation and extract text from all slides.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        presentation_id: { type: 'string', description: 'Google Slides URL or presentation ID' },
      },
      required: ['presentation_id'],
    },
  },
  {
    name: 'gdrive_search',
    description: 'Search Google Drive for files by name or content. Returns file names, IDs, links, and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (searches file names and content)' },
        limit: { type: 'number', description: 'Max results to return (default 15)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'gdrive_get_file',
    description: 'Read a file from Google Drive by URL or file ID. Supports Docs, Sheets, Slides, and plain text files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        file_id: { type: 'string', description: 'Google Drive file URL or file ID' },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'gcal_get_events',
    description: 'Get calendar events from Google Calendar. Useful for finding meeting context, schedules, and upcoming discussions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        days_back: { type: 'number', description: 'Number of days in the past to search (default 7)' },
        days_ahead: { type: 'number', description: 'Number of days in the future to search (default 7)' },
        limit: { type: 'number', description: 'Max events to return (default 20)' },
        query: { type: 'string', description: 'Optional text search to filter events' },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, any>;

  try {
    let result: string;

    switch (name) {
      case 'slack_get_my_mentions':
        result = await slackGetMyMentions({ limit: a.limit });
        break;
      case 'slack_get_thread':
        result = await slackGetThread({ channel: a.channel, thread_ts: a.thread_ts, limit: a.limit });
        break;
      case 'slack_search_messages':
        result = await slackSearchMessages({ query: a.query, limit: a.limit });
        break;
      case 'slack_post_message':
        result = await slackPostMessage({ channel: a.channel, text: a.text, thread_ts: a.thread_ts });
        break;
      case 'jira_search_issues':
        result = await jiraSearchIssues({ query: a.query, limit: a.limit });
        break;
      case 'jira_get_issue':
        result = await jiraGetIssue({ issue_key: a.issue_key });
        break;
      case 'jira_get_issue_comments':
        result = await jiraGetIssueComments({ issue_key: a.issue_key, limit: a.limit });
        break;
      case 'docs_search':
        result = await docsSearch({ query: a.query, limit: a.limit });
        break;
      case 'docs_get_page':
        result = await docsGetPage({ url: a.url });
        break;
      case 'code_search':
        result = await codeSearch({ query: a.query, path: a.path, extension: a.extension, limit: a.limit });
        break;
      case 'code_get_file':
        result = await codeGetFile({ path: a.path, ref: a.ref });
        break;
      case 'gdocs_read':
        result = await gdocsRead({ document_id: a.document_id });
        break;
      case 'gsheets_read':
        result = await gsheetsRead({ spreadsheet_id: a.spreadsheet_id, range: a.range });
        break;
      case 'gslides_read':
        result = await gslidesRead({ presentation_id: a.presentation_id });
        break;
      case 'gdrive_search':
        result = await gdriveSearch({ query: a.query, limit: a.limit });
        break;
      case 'gdrive_get_file':
        result = await gdriveGetFile({ file_id: a.file_id });
        break;
      case 'gcal_get_events':
        result = await gcalGetEvents({ days_back: a.days_back, days_ahead: a.days_ahead, limit: a.limit, query: a.query });
        break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message || error}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
