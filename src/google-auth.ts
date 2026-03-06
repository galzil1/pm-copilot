#!/usr/bin/env node

import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';

const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

function parseArgs(): { clientId: string; clientSecret: string } {
  const args = process.argv.slice(2);
  let clientId = '';
  let clientSecret = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client-id' && args[i + 1]) {
      clientId = args[++i];
    } else if (args[i] === '--client-secret' && args[i + 1]) {
      clientSecret = args[++i];
    }
  }

  if (!clientId || !clientSecret) {
    console.error('Usage: node dist/google-auth.js --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET');
    process.exit(1);
  }

  return { clientId, clientSecret };
}

async function main() {
  const { clientId, clientSecret } = parseArgs();

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n=== Google Workspace Authorization ===\n');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...\n');

  const code = await waitForCallback();

  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error('No refresh token received. Try revoking access at https://myaccount.google.com/permissions and running again.');
    process.exit(1);
  }

  console.log('\n=== Success! ===\n');
  console.log('Your refresh token:\n');
  console.log(tokens.refresh_token);
  console.log('\nAdd this to your .cursor/mcp.json under the pm-copilot env section:');
  console.log(`  "GOOGLE_REFRESH_TOKEN": "${tokens.refresh_token}"`);
  console.log();

  process.exit(0);
}

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url || '', true);

      if (parsed.pathname === '/callback') {
        const code = parsed.query.code as string;
        const error = parsed.query.error as string;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization denied</h1><p>You can close this tab.</p>');
          server.close();
          reject(new Error(`Authorization denied: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>');
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(REDIRECT_PORT, () => {
      // Server is listening, waiting for the OAuth callback
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for authorization (120 seconds)'));
    }, 120000);
  });
}

main().catch((error) => {
  console.error(`Error: ${error.message || error}`);
  process.exit(1);
});
