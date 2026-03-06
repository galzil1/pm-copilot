import axios from 'axios';

const DOCS_BASE = 'https://jfrog.com/help/r/jfrog-artifactory-documentation';

const KNOWN_DOCS: Record<string, { title: string; url: string }[]> = {
  replication: [
    { title: 'Repository Replication', url: `${DOCS_BASE}/repository-replication` },
    { title: 'Push Replication', url: `${DOCS_BASE}/push-replication` },
    { title: 'Pull Replication', url: `${DOCS_BASE}/pull-replication` },
    { title: 'Event Replication', url: `${DOCS_BASE}/event-replication` },
    { title: 'Configuring Replication', url: `${DOCS_BASE}/configuring-push-replication` },
  ],
  repository: [
    { title: 'Repository Management', url: `${DOCS_BASE}/repository-management` },
    { title: 'Local Repositories', url: `${DOCS_BASE}/local-repositories` },
    { title: 'Remote Repositories', url: `${DOCS_BASE}/remote-repositories` },
    { title: 'Virtual Repositories', url: `${DOCS_BASE}/virtual-repositories` },
    { title: 'Federated Repositories', url: `${DOCS_BASE}/federated-repositories` },
  ],
  docker: [
    { title: 'Docker Registry', url: `${DOCS_BASE}/docker-registry` },
    { title: 'Getting Started with Docker', url: `${DOCS_BASE}/getting-started-with-artifactory-as-a-docker-registry` },
    { title: 'Docker Cleanup Policies', url: `${DOCS_BASE}/docker-cleanup-policies` },
  ],
  npm: [
    { title: 'npm Registry', url: `${DOCS_BASE}/npm-registry` },
    { title: 'npm Repositories', url: `${DOCS_BASE}/npm-repositories` },
  ],
  maven: [
    { title: 'Maven Repository', url: `${DOCS_BASE}/maven-repository` },
    { title: 'Maven Snapshots', url: `${DOCS_BASE}/maven-snapshot-version-handling` },
  ],
  permissions: [
    { title: 'Permissions', url: `${DOCS_BASE}/permissions` },
    { title: 'Permission Targets', url: `${DOCS_BASE}/permission-targets` },
    { title: 'Access Tokens', url: `${DOCS_BASE}/access-tokens` },
  ],
  security: [
    { title: 'Security Configuration', url: `${DOCS_BASE}/security-configuration` },
    { title: 'Access Tokens', url: `${DOCS_BASE}/access-tokens` },
    { title: 'API Keys', url: `${DOCS_BASE}/api-key` },
  ],
  cleanup: [
    { title: 'Cleanup Policies', url: `${DOCS_BASE}/cleanup-policies` },
    { title: 'Docker Cleanup Policies', url: `${DOCS_BASE}/docker-cleanup-policies` },
    { title: 'Artifact Cleanup', url: `${DOCS_BASE}/artifact-cleanup` },
  ],
  'rest api': [
    { title: 'Artifactory REST API', url: `${DOCS_BASE}/artifactory-rest-api` },
    { title: 'System REST API', url: `${DOCS_BASE}/system-rest-api` },
    { title: 'Repositories REST API', url: `${DOCS_BASE}/repositories-rest-api` },
    { title: 'Builds REST API', url: `${DOCS_BASE}/builds-rest-api` },
    { title: 'Search REST API', url: `${DOCS_BASE}/search-rest-api` },
  ],
  aql: [
    { title: 'Artifactory Query Language', url: `${DOCS_BASE}/artifactory-query-language` },
    { title: 'AQL Syntax', url: `${DOCS_BASE}/aql-syntax` },
  ],
  storage: [
    { title: 'Configuring Storage', url: `${DOCS_BASE}/configuring-storage` },
    { title: 'Storage Summary', url: `${DOCS_BASE}/storage-summary` },
    { title: 'Filestore Configuration', url: `${DOCS_BASE}/filestore-configuration` },
  ],
  backup: [
    { title: 'System Backup', url: `${DOCS_BASE}/system-backup-and-restore` },
    { title: 'Backup and Restore', url: `${DOCS_BASE}/backup-and-restore` },
  ],
  properties: [
    { title: 'Properties', url: `${DOCS_BASE}/properties` },
    { title: 'Setting Properties', url: `${DOCS_BASE}/setting-properties` },
    { title: 'Using Properties in Deployment', url: `${DOCS_BASE}/using-properties-in-deployment-and-resolution` },
  ],
  build: [
    { title: 'Build Integration', url: `${DOCS_BASE}/build-integration` },
    { title: 'Build Info', url: `${DOCS_BASE}/build-info` },
  ],
  cache: [
    { title: 'Remote Repository Caching', url: `${DOCS_BASE}/remote-repository-caching` },
    { title: 'Cache Configuration', url: `${DOCS_BASE}/cache-configuration` },
  ],
  proxy: [
    { title: 'Managing Proxies', url: `${DOCS_BASE}/managing-proxies` },
    { title: 'Reverse Proxy Configuration', url: `${DOCS_BASE}/reverse-proxy-configuration` },
  ],
  high_availability: [
    { title: 'High Availability', url: `${DOCS_BASE}/high-availability` },
    { title: 'HA Cluster Setup', url: `${DOCS_BASE}/ha-cluster-setup` },
  ],
  webhook: [
    { title: 'Webhooks', url: `${DOCS_BASE}/webhooks` },
    { title: 'Configuring Webhooks', url: `${DOCS_BASE}/configuring-webhooks` },
  ],
};

function findMatchingDocs(query: string): { title: string; url: string }[] {
  const lowerQuery = query.toLowerCase();
  const matches: { title: string; url: string; score: number }[] = [];

  for (const [topic, pages] of Object.entries(KNOWN_DOCS)) {
    const topicWords = topic.split(/[_ ]/);
    const matchScore = topicWords.filter((w) => lowerQuery.includes(w)).length;
    if (matchScore > 0) {
      for (const page of pages) {
        const titleScore = page.title.toLowerCase().split(/\s+/).filter((w) => lowerQuery.includes(w.toLowerCase())).length;
        matches.push({ ...page, score: matchScore + titleScore });
      }
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return matches
    .sort((a, b) => b.score - a.score)
    .filter((m) => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    });
}

export async function docsSearch(args: {
  query: string;
  limit?: number;
}): Promise<string> {
  const limit = args.limit || 10;
  const matches = findMatchingDocs(args.query).slice(0, limit);

  const querySlug = args.query.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const guessedUrl = `${DOCS_BASE}/${querySlug}`;

  let result = `## JFrog Documentation Search: "${args.query}"\n\n`;

  if (matches.length > 0) {
    result += `**Matching documentation pages:**\n\n`;
    matches.forEach((m, i) => {
      result += `${i + 1}. [${m.title}](${m.url})\n`;
    });
    result += '\n';
  }

  result += `**Direct link attempt:** ${guessedUrl}\n`;
  result += `**Browse docs:** ${DOCS_BASE}\n`;
  result += `**Search on site:** https://jfrog.com/help/s/global-search/%40uri?q=${encodeURIComponent(args.query)}\n\n`;
  result += `_Note: JFrog docs is a client-rendered SPA. Use Cursor's WebFetch tool to read full page content from the URLs above._`;

  return result;
}

export async function docsGetPage(args: {
  url: string;
}): Promise<string> {
  const url = args.url.startsWith('http') ? args.url : `${DOCS_BASE}/${args.url}`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'pm-copilot/1.0', Accept: 'text/html' },
      timeout: 15000,
      maxRedirects: 5,
    });

    if (response.status === 200) {
      const html: string = response.data;
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '').trim() : '';
      const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i);
      const description = metaDesc ? metaDesc[1] : '';

      let result = `# ${title || 'JFrog Documentation Page'}\n`;
      result += `URL: ${url}\n`;
      if (description) result += `Description: ${description}\n`;
      result += `\n_This page is a client-rendered SPA. The URL is valid but content must be fetched with a browser-capable tool. Use Cursor's WebFetch tool on the URL above to read the full content._\n`;

      return result;
    }

    return `Page returned status ${response.status}: ${url}`;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return `Page not found: ${url}\n\nTry searching at: ${DOCS_BASE}`;
    }
    return `Error fetching page: ${error.message}\n\nDirect link: ${url}`;
  }
}
