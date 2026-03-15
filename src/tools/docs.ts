import axios from 'axios';

const DOCS_LEGACY_BASE = 'https://jfrog.com/help/r/jfrog-artifactory-documentation';
const DOCS_NEW_BASE = 'https://docs.jfrog.com/artifactory/docs';
const DOCS_NEW_CROSS = 'https://docs.jfrog.com/docs';

interface DocEntry { title: string; url: string; source: 'legacy' | 'new' }

const KNOWN_DOCS: Record<string, DocEntry[]> = {
  replication: [
    { title: 'Repository Replication', url: `${DOCS_LEGACY_BASE}/repository-replication`, source: 'legacy' },
    { title: 'Push Replication', url: `${DOCS_LEGACY_BASE}/push-replication`, source: 'legacy' },
    { title: 'Pull Replication', url: `${DOCS_LEGACY_BASE}/pull-replication`, source: 'legacy' },
    { title: 'Event Replication', url: `${DOCS_LEGACY_BASE}/event-replication`, source: 'legacy' },
    { title: 'Configuring Replication', url: `${DOCS_LEGACY_BASE}/configuring-push-replication`, source: 'legacy' },
    { title: 'Repository Replication (new docs)', url: `${DOCS_NEW_CROSS}/repository-replication`, source: 'new' },
    { title: 'Federated Repositories (new docs)', url: `${DOCS_NEW_CROSS}/federated-repositories`, source: 'new' },
  ],
  repository: [
    { title: 'Repository Management', url: `${DOCS_LEGACY_BASE}/repository-management`, source: 'legacy' },
    { title: 'Local Repositories', url: `${DOCS_LEGACY_BASE}/local-repositories`, source: 'legacy' },
    { title: 'Remote Repositories', url: `${DOCS_LEGACY_BASE}/remote-repositories`, source: 'legacy' },
    { title: 'Virtual Repositories', url: `${DOCS_LEGACY_BASE}/virtual-repositories`, source: 'legacy' },
    { title: 'Federated Repositories', url: `${DOCS_LEGACY_BASE}/federated-repositories`, source: 'legacy' },
    { title: 'Repository Management (new docs)', url: `${DOCS_NEW_BASE}/repository-management`, source: 'new' },
    { title: 'Repository Management Overview (new docs)', url: `${DOCS_NEW_BASE}/repository-management-overview`, source: 'new' },
    { title: 'Local Repositories (new docs)', url: `${DOCS_NEW_CROSS}/local-repositories`, source: 'new' },
    { title: 'Remote Repositories (new docs)', url: `${DOCS_NEW_CROSS}/remote-repositories`, source: 'new' },
    { title: 'Virtual Repositories (new docs)', url: `${DOCS_NEW_CROSS}/virtual-repositories`, source: 'new' },
    { title: 'Federated Repositories (new docs)', url: `${DOCS_NEW_CROSS}/federated-repositories`, source: 'new' },
  ],
  docker: [
    { title: 'Docker Registry', url: `${DOCS_LEGACY_BASE}/docker-registry`, source: 'legacy' },
    { title: 'Getting Started with Docker', url: `${DOCS_LEGACY_BASE}/getting-started-with-artifactory-as-a-docker-registry`, source: 'legacy' },
    { title: 'Docker Cleanup Policies', url: `${DOCS_LEGACY_BASE}/docker-cleanup-policies`, source: 'legacy' },
    { title: 'Docker Repositories (new docs)', url: `${DOCS_NEW_CROSS}/docker-repositories`, source: 'new' },
  ],
  npm: [
    { title: 'npm Registry', url: `${DOCS_LEGACY_BASE}/npm-registry`, source: 'legacy' },
    { title: 'npm Repositories', url: `${DOCS_LEGACY_BASE}/npm-repositories`, source: 'legacy' },
    { title: 'npm Repositories (new docs)', url: `${DOCS_NEW_CROSS}/npm-repositories`, source: 'new' },
  ],
  maven: [
    { title: 'Maven Repository', url: `${DOCS_LEGACY_BASE}/maven-repository`, source: 'legacy' },
    { title: 'Maven Snapshots', url: `${DOCS_LEGACY_BASE}/maven-snapshot-version-handling`, source: 'legacy' },
    { title: 'Maven Repositories (new docs)', url: `${DOCS_NEW_CROSS}/maven-repositories`, source: 'new' },
  ],
  permissions: [
    { title: 'Permissions', url: `${DOCS_LEGACY_BASE}/permissions`, source: 'legacy' },
    { title: 'Permission Targets', url: `${DOCS_LEGACY_BASE}/permission-targets`, source: 'legacy' },
    { title: 'Access Tokens', url: `${DOCS_LEGACY_BASE}/access-tokens`, source: 'legacy' },
  ],
  security: [
    { title: 'Security Configuration', url: `${DOCS_LEGACY_BASE}/security-configuration`, source: 'legacy' },
    { title: 'Access Tokens', url: `${DOCS_LEGACY_BASE}/access-tokens`, source: 'legacy' },
    { title: 'API Keys', url: `${DOCS_LEGACY_BASE}/api-key`, source: 'legacy' },
    { title: 'Get Started with Security (new docs)', url: 'https://docs.jfrog.com/security/docs/get-started-with-jfrog-security', source: 'new' },
  ],
  cleanup: [
    { title: 'Cleanup Policies', url: `${DOCS_LEGACY_BASE}/cleanup-policies`, source: 'legacy' },
    { title: 'Docker Cleanup Policies', url: `${DOCS_LEGACY_BASE}/docker-cleanup-policies`, source: 'legacy' },
    { title: 'Artifact Cleanup', url: `${DOCS_LEGACY_BASE}/artifact-cleanup`, source: 'legacy' },
  ],
  'rest api': [
    { title: 'Artifactory REST API', url: `${DOCS_LEGACY_BASE}/artifactory-rest-api`, source: 'legacy' },
    { title: 'System REST API', url: `${DOCS_LEGACY_BASE}/system-rest-api`, source: 'legacy' },
    { title: 'Repositories REST API', url: `${DOCS_LEGACY_BASE}/repositories-rest-api`, source: 'legacy' },
    { title: 'Builds REST API', url: `${DOCS_LEGACY_BASE}/builds-rest-api`, source: 'legacy' },
    { title: 'Search REST API', url: `${DOCS_LEGACY_BASE}/search-rest-api`, source: 'legacy' },
  ],
  aql: [
    { title: 'Artifactory Query Language', url: `${DOCS_LEGACY_BASE}/artifactory-query-language`, source: 'legacy' },
    { title: 'AQL Syntax', url: `${DOCS_LEGACY_BASE}/aql-syntax`, source: 'legacy' },
  ],
  storage: [
    { title: 'Configuring Storage', url: `${DOCS_LEGACY_BASE}/configuring-storage`, source: 'legacy' },
    { title: 'Storage Summary', url: `${DOCS_LEGACY_BASE}/storage-summary`, source: 'legacy' },
    { title: 'Filestore Configuration', url: `${DOCS_LEGACY_BASE}/filestore-configuration`, source: 'legacy' },
  ],
  backup: [
    { title: 'System Backup', url: `${DOCS_LEGACY_BASE}/system-backup-and-restore`, source: 'legacy' },
    { title: 'Backup and Restore', url: `${DOCS_LEGACY_BASE}/backup-and-restore`, source: 'legacy' },
  ],
  properties: [
    { title: 'Properties', url: `${DOCS_LEGACY_BASE}/properties`, source: 'legacy' },
    { title: 'Setting Properties', url: `${DOCS_LEGACY_BASE}/setting-properties`, source: 'legacy' },
    { title: 'Using Properties in Deployment', url: `${DOCS_LEGACY_BASE}/using-properties-in-deployment-and-resolution`, source: 'legacy' },
  ],
  build: [
    { title: 'Build Integration', url: `${DOCS_LEGACY_BASE}/build-integration`, source: 'legacy' },
    { title: 'Build Info', url: `${DOCS_LEGACY_BASE}/build-info`, source: 'legacy' },
    { title: 'About Build Info (new docs)', url: 'https://docs.jfrog.com/integrations/docs/about-build-info', source: 'new' },
  ],
  cache: [
    { title: 'Remote Repository Caching', url: `${DOCS_LEGACY_BASE}/remote-repository-caching`, source: 'legacy' },
    { title: 'Cache Configuration', url: `${DOCS_LEGACY_BASE}/cache-configuration`, source: 'legacy' },
  ],
  proxy: [
    { title: 'Managing Proxies', url: `${DOCS_LEGACY_BASE}/managing-proxies`, source: 'legacy' },
    { title: 'Reverse Proxy Configuration', url: `${DOCS_LEGACY_BASE}/reverse-proxy-configuration`, source: 'legacy' },
  ],
  high_availability: [
    { title: 'High Availability', url: `${DOCS_LEGACY_BASE}/high-availability`, source: 'legacy' },
    { title: 'HA Cluster Setup', url: `${DOCS_LEGACY_BASE}/ha-cluster-setup`, source: 'legacy' },
  ],
  webhook: [
    { title: 'Webhooks', url: `${DOCS_LEGACY_BASE}/webhooks`, source: 'legacy' },
    { title: 'Configuring Webhooks', url: `${DOCS_LEGACY_BASE}/configuring-webhooks`, source: 'legacy' },
  ],
  package: [
    { title: 'Supported Package Types (new docs)', url: `${DOCS_NEW_BASE}/supported-package-types`, source: 'new' },
    { title: 'Working with Package Management (new docs)', url: `${DOCS_NEW_BASE}/working-with-package-management`, source: 'new' },
    { title: 'Package Use Cases (new docs)', url: `${DOCS_NEW_BASE}/package-and-repositories-use-cases`, source: 'new' },
  ],
  distribution: [
    { title: 'JFrog Distribution (new docs)', url: `${DOCS_NEW_BASE}/jfrog-distribution`, source: 'new' },
  ],
  search: [
    { title: 'Searching for Artifacts (new docs)', url: `${DOCS_NEW_BASE}/understanding-how-to-search-for-artifacts-and-packages`, source: 'new' },
    { title: 'Supported Search Methods (new docs)', url: `${DOCS_NEW_BASE}/supported-search-methods`, source: 'new' },
    { title: 'Browsing Artifacts (new docs)', url: `${DOCS_NEW_BASE}/browsing-artifacts`, source: 'new' },
  ],
  upload: [
    { title: 'Upload and Download Packages (new docs)', url: `${DOCS_NEW_BASE}/upload-and-download-packages-using-artifactory`, source: 'new' },
  ],
  setup: [
    { title: 'Getting Started (new docs)', url: `${DOCS_NEW_BASE}/getting-started`, source: 'new' },
    { title: 'Set up JFrog (new docs)', url: 'https://docs.jfrog.com/setup/docs/get-started', source: 'new' },
  ],
  installation: [
    { title: 'Self-Managed Installation (new docs)', url: 'https://docs.jfrog.com/installation/docs/getting-started', source: 'new' },
  ],
};

function findMatchingDocs(query: string): DocEntry[] {
  const lowerQuery = query.toLowerCase();
  const matches: (DocEntry & { score: number })[] = [];

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
  const legacyGuess = `${DOCS_LEGACY_BASE}/${querySlug}`;
  const newGuess = `${DOCS_NEW_BASE}/${querySlug}`;

  const legacyMatches = matches.filter((m) => m.source === 'legacy');
  const newMatches = matches.filter((m) => m.source === 'new');

  let result = `## JFrog Documentation Search: "${args.query}"\n\n`;

  if (newMatches.length > 0) {
    result += `### docs.jfrog.com (new)\n\n`;
    newMatches.forEach((m, i) => {
      result += `${i + 1}. [${m.title}](${m.url})\n`;
    });
    result += '\n';
  }

  if (legacyMatches.length > 0) {
    result += `### jfrog.com/help (legacy)\n\n`;
    legacyMatches.forEach((m, i) => {
      result += `${i + 1}. [${m.title}](${m.url})\n`;
    });
    result += '\n';
  }

  result += `**Direct link attempts:**\n`;
  result += `- New docs: ${newGuess}\n`;
  result += `- Legacy docs: ${legacyGuess}\n\n`;
  result += `**Browse docs:**\n`;
  result += `- New: https://docs.jfrog.com/artifactory\n`;
  result += `- Legacy: ${DOCS_LEGACY_BASE}\n\n`;
  result += `**Search on site:** https://jfrog.com/help/s/global-search/%40uri?q=${encodeURIComponent(args.query)}\n\n`;
  result += `_Tip: Use Cursor's WebFetch tool to read full page content from the URLs above._`;

  return result;
}

export async function docsGetPage(args: {
  url: string;
}): Promise<string> {
  let url: string;
  if (args.url.startsWith('http')) {
    url = args.url;
  } else if (args.url.startsWith('docs/') || args.url.includes('/docs/')) {
    url = `https://docs.jfrog.com/artifactory/${args.url}`;
  } else {
    url = `${DOCS_NEW_BASE}/${args.url}`;
  }

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
      result += `\n_Tip: Use Cursor's WebFetch tool on the URL above to read the full rendered content._\n`;

      return result;
    }

    return `Page returned status ${response.status}: ${url}`;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return `Page not found: ${url}\n\nTry:\n- New docs: https://docs.jfrog.com/artifactory\n- Legacy docs: ${DOCS_LEGACY_BASE}`;
    }
    return `Error fetching page: ${error.message}\n\nDirect link: ${url}`;
  }
}
