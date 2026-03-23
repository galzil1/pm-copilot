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

function parseInlineMarks(text: string): any[] {
  const result: any[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|([^*`]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      result.push({ type: 'text', text: match[2], marks: [{ type: 'strong' }] });
    } else if (match[4]) {
      result.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] });
    } else if (match[5]) {
      result.push({ type: 'text', text: match[5] });
    }
  }
  return result.length > 0 ? result : [{ type: 'text', text }];
}

function markdownToAdf(markdown: string): object {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineMarks(headingMatch[2]),
      });
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: any[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s+/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlineMarks(text) }],
        });
        i++;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: any[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[-*]\s+/, '');
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInlineMarks(text) }],
        });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,6}\s/) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      content.push({
        type: 'paragraph',
        content: parseInlineMarks(paraLines.join(' ')),
      });
    }
  }

  return { version: 1, type: 'doc', content };
}

export async function jiraCreateIssue(args: {
  project_key: string;
  summary: string;
  description: string;
  issue_type?: string;
  priority?: string;
  labels?: string[];
  epic_key?: string;
  assignee_email?: string;
  link_to?: string;
  link_type?: string;
}): Promise<string> {
  const client = createClient();
  const issueType = args.issue_type || 'Story';

  const fields: Record<string, any> = {
    project: { key: args.project_key },
    summary: args.summary,
    issuetype: { name: issueType },
    description: markdownToAdf(args.description),
  };

  if (args.priority) fields.priority = { name: args.priority };
  if (args.labels?.length) fields.labels = args.labels;
  if (args.epic_key) fields.parent = { key: args.epic_key };
  if (args.assignee_email) fields.assignee = { id: args.assignee_email };

  try {
    const response = await client.post('/rest/api/3/issue', { fields });
    const key = response.data.key;
    const url = `${config.jira.host}/browse/${key}`;

    let result = `Created **${key}**: ${args.summary}\nURL: ${url}`;

    if (args.link_to) {
      try {
        await client.post('/rest/api/3/issueLink', {
          type: { name: args.link_type || 'Relates' },
          inwardIssue: { key },
          outwardIssue: { key: args.link_to },
        });
        result += `\nLinked to ${args.link_to}`;
      } catch (linkError: any) {
        const msg = linkError.response?.data?.errorMessages?.join(', ') || linkError.message;
        result += `\nWarning: issue created but linking to ${args.link_to} failed: ${msg}`;
      }
    }

    return result;
  } catch (error: any) {
    const data = error.response?.data;
    const msgs = data?.errorMessages?.join(', ') || '';
    const errs = data?.errors ? JSON.stringify(data.errors) : '';
    const msg = msgs || errs || error.message || error;
    return `Error creating issue: ${msg}`;
  }
}

export async function jiraUpdateIssue(args: {
  issue_key: string;
  summary?: string;
  description?: string;
  fields?: Record<string, any>;
}): Promise<string> {
  const client = createClient();
  const updateFields: Record<string, any> = {};

  if (args.summary) updateFields.summary = args.summary;
  if (args.description) updateFields.description = markdownToAdf(args.description);
  if (args.fields) {
    for (const [key, value] of Object.entries(args.fields)) {
      if (typeof value === 'string' && key.startsWith('customfield_')) {
        updateFields[key] = markdownToAdf(value);
      } else {
        updateFields[key] = value;
      }
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return 'No fields to update.';
  }

  try {
    await client.put(`/rest/api/3/issue/${args.issue_key}`, { fields: updateFields });
    const url = `${config.jira.host}/browse/${args.issue_key}`;
    return `Updated **${args.issue_key}** successfully.\nURL: ${url}\nFields updated: ${Object.keys(updateFields).join(', ')}`;
  } catch (error: any) {
    const data = error.response?.data;
    const msgs = data?.errorMessages?.join(', ') || '';
    const errs = data?.errors ? JSON.stringify(data.errors) : '';
    const msg = msgs || errs || error.message || error;
    return `Error updating ${args.issue_key}: ${msg}`;
  }
}

export async function jiraGetEditableFields(args: {
  issue_key: string;
  search?: string;
}): Promise<string> {
  const client = createClient();

  try {
    const response = await client.get(`/rest/api/3/issue/${args.issue_key}/editmeta`);
    const fields = response.data.fields || {};
    const results: string[] = [];

    for (const [id, meta] of Object.entries(fields)) {
      const m = meta as any;
      const name = m.name || id;
      if (args.search && !name.toLowerCase().includes(args.search.toLowerCase()) && !id.toLowerCase().includes(args.search.toLowerCase())) {
        continue;
      }
      const type = m.schema?.type || 'unknown';
      const allowed = m.allowedValues?.slice(0, 5).map((v: any) => v.value || v.name || v.id).join(', ');
      let line = `**${id}**: ${name} (${type})`;
      if (allowed) line += ` — allowed: [${allowed}]`;
      results.push(line);
    }

    return results.length > 0
      ? `Editable fields for ${args.issue_key}:\n\n${results.join('\n')}`
      : `No matching editable fields found for ${args.issue_key}.`;
  } catch (error: any) {
    const msg = error.response?.data?.errorMessages?.join(', ') || error.message || error;
    return `Error fetching editable fields for ${args.issue_key}: ${msg}`;
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
