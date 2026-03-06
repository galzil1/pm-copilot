import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

function createClient(): AxiosInstance {
  const baseURL = config.github.url.replace(/\/$/, '');
  return axios.create({
    baseURL: `${baseURL}/api/v3`,
    headers: {
      Authorization: `token ${config.github.token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    proxy: false,
    timeout: 30000,
  });
}

export async function codeSearch(args: {
  query: string;
  path?: string;
  extension?: string;
  limit?: number;
}): Promise<string> {
  const client = createClient();
  const limit = args.limit || 15;

  let searchQuery = `${args.query} repo:${config.github.repo}`;
  if (args.path) searchQuery += ` path:${args.path}`;
  if (args.extension) searchQuery += ` extension:${args.extension}`;

  try {
    const response = await client.get('/search/code', {
      params: {
        q: searchQuery,
        per_page: limit,
      },
      headers: {
        Accept: 'application/vnd.github.v3.text-match+json',
      },
    });

    const items = response.data.items || [];
    if (items.length === 0) {
      return `No code results found for: "${args.query}" in ${config.github.repo}`;
    }

    const header = `Found ${response.data.total_count} result(s) (showing ${items.length}) for "${args.query}":\n\n`;

    const formatted = items.map((item: any, i: number) => {
      const matches = item.text_matches
        ?.map((m: any) => m.fragment)
        .join('\n...\n') || '(no preview available)';
      return `${i + 1}. **${item.path}**\n   ${item.html_url}\n\n\`\`\`\n${matches}\n\`\`\``;
    });

    return header + formatted.join('\n\n---\n\n');
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 403) {
      return 'Error: GitHub API rate limit exceeded. Try again later.';
    }
    if (status === 401) {
      return 'Error: GitHub authentication failed. Check GITHUB_ENTERPRISE_TOKEN.';
    }
    return `Error searching code: ${error.message || error}`;
  }
}

export async function codeGetFile(args: {
  path: string;
  ref?: string;
}): Promise<string> {
  const client = createClient();
  const [owner, repo] = config.github.repo.split('/');

  try {
    const response = await client.get(`/repos/${owner}/${repo}/contents/${args.path}`, {
      params: args.ref ? { ref: args.ref } : {},
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const data = response.data;

    if (Array.isArray(data)) {
      const entries = data.map((entry: any) => {
        const icon = entry.type === 'dir' ? '/' : '';
        return `  ${entry.name}${icon}`;
      });
      return `Directory listing for ${args.path}:\n\n${entries.join('\n')}`;
    }

    if (data.type === 'file') {
      if (data.size > 500000) {
        return `File ${args.path} is too large (${(data.size / 1024).toFixed(1)} KB). Use code_search to find specific content within it.`;
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      if (content.length > 10000) {
        return `# ${args.path}\nSize: ${data.size} bytes\n\n\`\`\`\n${content.substring(0, 10000)}\n\`\`\`\n\n... (file truncated at 10,000 characters)`;
      }

      return `# ${args.path}\nSize: ${data.size} bytes\n\n\`\`\`\n${content}\n\`\`\``;
    }

    return `Unsupported content type: ${data.type}`;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return `File not found: ${args.path} in ${config.github.repo}`;
    }
    return `Error fetching file: ${error.message || error}`;
  }
}
