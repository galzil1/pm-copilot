/**
 * Smoke test: spawn pm-copilot and run initialize + tools/list.
 * Run: node scripts/smoke-mcp.cjs
 */
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const dist = path.join(__dirname, '..', 'dist', 'index.js');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [dist],
    env: process.env,
  });
  const client = new Client({ name: 'smoke-test', version: '0.0.0' });
  await client.connect(transport);
  console.log('connect ok (initialize is automatic)');
  const tools = await client.listTools();
  console.log('tools count:', tools.tools?.length ?? 0);
  await client.close();
  console.log('smoke ok');
}

main().catch((e) => {
  console.error('smoke failed:', e);
  process.exit(1);
});
