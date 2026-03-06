import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: config.jira.host,
    auth: {
      username: config.jira.email,
      password: config.jira.apiToken,
    },
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    proxy: false,
  });
}

function extractTextFromADF(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const obj = node as Record<string, unknown>;
  if (obj.text && typeof obj.text === 'string') return obj.text;
  if (Array.isArray(obj.content)) {
    return obj.content.map(extractTextFromADF).join(' ');
  }
  return '';
}

function parseDescription(description: unknown): string {
  if (!description) return '(no description)';
  if (typeof description === 'object') return extractTextFromADF(description);
  if (typeof description === 'string') {
    if (description.startsWith('{')) {
      try {
        return extractTextFromADF(JSON.parse(description));
      } catch {
        return description;
      }
    }
    return description;
  }
  return String(description);
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;
    status: { name: string };
    priority?: { name: string };
    issuetype: { name: string };
    created: string;
    updated: string;
    assignee?: { displayName: string; emailAddress: string };
    reporter?: { displayName: string; emailAddress: string };
    project: { key: string; name: string };
    labels?: string[];
    components?: { name: string }[];
    fixVersions?: { name: string }[];
  };
}

function formatIssue(issue: JiraIssue, verbose: boolean = false): string {
  const f = issue.fields;
  const url = `${config.jira.host}/browse/${issue.key}`;
  let out = `**${issue.key}** - ${f.summary}\n`;
  out += `Status: ${f.status.name} | Type: ${f.issuetype.name}`;
  if (f.priority) out += ` | Priority: ${f.priority.name}`;
  out += `\nProject: ${f.project.name} (${f.project.key})`;
  if (f.assignee) out += `\nAssignee: ${f.assignee.displayName}`;
  if (f.reporter) out += `\nReporter: ${f.reporter.displayName}`;
  out += `\nCreated: ${f.created} | Updated: ${f.updated}`;
  if (f.labels?.length) out += `\nLabels: ${f.labels.join(', ')}`;
  if (f.components?.length) out += `\nComponents: ${f.components.map((c) => c.name).join(', ')}`;
  if (f.fixVersions?.length) out += `\nFix Versions: ${f.fixVersions.map((v) => v.name).join(', ')}`;
  out += `\nURL: ${url}`;

  if (verbose) {
    const desc = parseDescription(f.description);
    const truncated = desc.length > 2000 ? desc.substring(0, 2000) + '...' : desc;
    out += `\n\nDescription:\n${truncated}`;
  }

  return out;
}

export async function jiraSearchIssues(args: {
  query: string;
  limit?: number;
}): Promise<string> {
  const client = createClient();
  const limit = args.limit || 20;

  const isJql = /\s*(assignee|reporter|project|status|priority|issuetype|created|updated|labels|text|summary|description)\s*(=|~|!=|!~|in|not in|is|is not|was|was not|>|<|>=|<=)\s*/i.test(args.query);

  const jql = isJql
    ? args.query
    : `text ~ "${args.query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;

  try {
    const response = await client.post('/rest/api/3/search/jql', {
      jql,
      maxResults: limit,
      fields: [
        'summary', 'description', 'status', 'priority', 'issuetype',
        'created', 'updated', 'assignee', 'reporter', 'project',
        'labels', 'components', 'fixVersions',
      ],
    });

    const issues: JiraIssue[] = response.data.issues || [];
    if (issues.length === 0) {
      return `No issues found for: ${args.query}`;
    }

    const total = response.data.total ?? response.data.totalSize ?? issues.length;
    const header = `Found ${total} issue(s) (showing ${issues.length}):\n\n`;
    return header + issues.map((i) => formatIssue(i)).join('\n\n---\n\n');
  } catch (error: any) {
    const msg = error.response?.data?.errorMessages?.join(', ') || error.message || error;
    return `Error searching Jira: ${msg}`;
  }
}

export async function jiraGetIssue(args: {
  issue_key: string;
}): Promise<string> {
  const client = createClient();

  try {
    const response = await client.get(`/rest/api/3/issue/${args.issue_key}`, {
      params: {
        fields: 'summary,description,status,priority,issuetype,created,updated,assignee,reporter,project,labels,components,fixVersions,comment',
      },
    });

    const issue: JiraIssue = response.data;
    let result = formatIssue(issue, true);

    const comments = response.data.fields?.comment?.comments || [];
    if (comments.length > 0) {
      result += `\n\n### Comments (${comments.length}):\n`;
      const latestComments = comments.slice(-10);
      for (const c of latestComments) {
        const author = c.author?.displayName || 'Unknown';
        const body = extractTextFromADF(c.body);
        const truncated = body.length > 500 ? body.substring(0, 500) + '...' : body;
        result += `\n[${c.created}] ${author}:\n${truncated}\n`;
      }
      if (comments.length > 10) {
        result += `\n... and ${comments.length - 10} earlier comment(s)`;
      }
    }

    return result;
  } catch (error: any) {
    const msg = error.response?.data?.errorMessages?.join(', ') || error.message || error;
    return `Error fetching issue ${args.issue_key}: ${msg}`;
  }
}

export async function jiraGetIssueComments(args: {
  issue_key: string;
  limit?: number;
}): Promise<string> {
  const client = createClient();
  const limit = args.limit || 30;

  try {
    const response = await client.get(`/rest/api/3/issue/${args.issue_key}/comment`, {
      params: {
        maxResults: limit,
        orderBy: '-created',
      },
    });

    const comments = response.data.comments || [];
    if (comments.length === 0) {
      return `No comments on ${args.issue_key}.`;
    }

    const header = `${args.issue_key} - ${comments.length} comment(s):\n\n`;
    const formatted = comments.map((c: any) => {
      const author = c.author?.displayName || 'Unknown';
      const body = extractTextFromADF(c.body);
      const truncated = body.length > 1000 ? body.substring(0, 1000) + '...' : body;
      return `[${c.created}] ${author}:\n${truncated}`;
    });

    return header + formatted.join('\n\n---\n\n');
  } catch (error: any) {
    const msg = error.response?.data?.errorMessages?.join(', ') || error.message || error;
    return `Error fetching comments for ${args.issue_key}: ${msg}`;
  }
}
