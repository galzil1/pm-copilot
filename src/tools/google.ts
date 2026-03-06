import { google } from 'googleapis';
import { config } from '../config';

const TRUNCATE_LIMIT = 15000;

function getAuth() {
  const oauth2 = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  oauth2.setCredentials({ refresh_token: config.google.refreshToken });
  return oauth2;
}

function extractDocId(urlOrId: string): string {
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId;
}

function extractFileId(urlOrId: string): string {
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/) || urlOrId.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId;
}

function truncate(text: string): string {
  if (text.length > TRUNCATE_LIMIT) {
    return text.substring(0, TRUNCATE_LIMIT) + `\n\n... (truncated at ${TRUNCATE_LIMIT} characters)`;
  }
  return text;
}

function extractDocText(doc: any): string {
  const lines: string[] = [];

  function processContent(content: any[]) {
    if (!content) return;
    for (const element of content) {
      if (element.paragraph) {
        const paragraphText = (element.paragraph.elements || [])
          .map((e: any) => e.textRun?.content || '')
          .join('');

        const style = element.paragraph.paragraphStyle?.namedStyleType;
        if (style?.startsWith('HEADING_')) {
          const level = parseInt(style.replace('HEADING_', ''), 10);
          lines.push('#'.repeat(level) + ' ' + paragraphText.trim());
        } else {
          lines.push(paragraphText);
        }
      } else if (element.table) {
        for (const row of element.table.tableRows || []) {
          const cells = (row.tableCells || []).map((cell: any) => {
            const cellText = (cell.content || [])
              .map((c: any) =>
                (c.paragraph?.elements || [])
                  .map((e: any) => e.textRun?.content || '')
                  .join('')
                  .trim()
              )
              .join(' ');
            return cellText;
          });
          lines.push('| ' + cells.join(' | ') + ' |');
        }
        lines.push('');
      }
    }
  }

  processContent(doc.body?.content || []);
  return lines.join('').replace(/\n{3,}/g, '\n\n').trim();
}

// --- Tool implementations ---

export async function gdocsRead(args: {
  document_id: string;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const docId = extractDocId(args.document_id);

  try {
    const docs = google.docs({ version: 'v1', auth: getAuth() });
    const response = await docs.documents.get({ documentId: docId });
    const doc = response.data;
    const title = doc.title || 'Untitled';
    const text = extractDocText(doc);

    return truncate(`# ${title}\n\n${text}`);
  } catch (error: any) {
    if (error.code === 404) return `Document not found: ${docId}`;
    if (error.code === 403) return `Access denied to document: ${docId}. Make sure it's shared with your Google account.`;
    return `Error reading document: ${error.message || error}`;
  }
}

export async function gsheetsRead(args: {
  spreadsheet_id: string;
  range?: string;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const sheetId = extractDocId(args.spreadsheet_id);

  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() });

    if (args.range) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: args.range,
      });
      const rows = response.data.values || [];
      if (rows.length === 0) return `No data found in range "${args.range}".`;

      const formatted = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
      return truncate(`## ${args.range}\n\n${formatted}`);
    }

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const title = meta.data.properties?.title || 'Untitled';
    const sheetNames = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);

    const allData: string[] = [`# ${title}\n`];

    for (const sheetName of sheetNames.slice(0, 10)) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: sheetName!,
        });
        const rows = response.data.values || [];
        if (rows.length === 0) continue;

        allData.push(`## ${sheetName}\n`);
        const formatted = rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n');
        allData.push(formatted + '\n');
      } catch {
        continue;
      }
    }

    return truncate(allData.join('\n'));
  } catch (error: any) {
    if (error.code === 404) return `Spreadsheet not found: ${sheetId}`;
    if (error.code === 403) return `Access denied to spreadsheet: ${sheetId}.`;
    return `Error reading spreadsheet: ${error.message || error}`;
  }
}

export async function gslidesRead(args: {
  presentation_id: string;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const presId = extractDocId(args.presentation_id);

  try {
    const slides = google.slides({ version: 'v1', auth: getAuth() });
    const response = await slides.presentations.get({ presentationId: presId });
    const pres = response.data;
    const title = pres.title || 'Untitled';

    const slideTexts: string[] = [`# ${title}\n`];

    for (let i = 0; i < (pres.slides || []).length; i++) {
      const slide = pres.slides![i];
      const texts: string[] = [];

      for (const element of slide.pageElements || []) {
        if (element.shape?.text?.textElements) {
          for (const te of element.shape.text.textElements) {
            if (te.textRun?.content) {
              texts.push(te.textRun.content.trim());
            }
          }
        }
        if (element.table) {
          for (const row of element.table.tableRows || []) {
            const cells = (row.tableCells || []).map((cell) =>
              (cell.text?.textElements || [])
                .map((te) => te.textRun?.content?.trim() || '')
                .filter(Boolean)
                .join(' ')
            );
            texts.push('| ' + cells.join(' | ') + ' |');
          }
        }
      }

      if (texts.length > 0) {
        slideTexts.push(`## Slide ${i + 1}\n${texts.join('\n')}\n`);
      }
    }

    return truncate(slideTexts.join('\n'));
  } catch (error: any) {
    if (error.code === 404) return `Presentation not found: ${presId}`;
    if (error.code === 403) return `Access denied to presentation: ${presId}.`;
    return `Error reading presentation: ${error.message || error}`;
  }
}

export async function gdriveSearch(args: {
  query: string;
  limit?: number;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const limit = args.limit || 15;

  try {
    const drive = google.drive({ version: 'v3', auth: getAuth() });
    const response = await drive.files.list({
      q: `fullText contains '${args.query.replace(/'/g, "\\'")}'`,
      pageSize: limit,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink, owners)',
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    if (files.length === 0) {
      return `No files found for: "${args.query}"`;
    }

    const header = `Found ${files.length} file(s) for "${args.query}":\n\n`;
    const formatted = files.map((f, i) => {
      const type = f.mimeType?.split('.').pop() || 'unknown';
      const owner = f.owners?.[0]?.displayName || '';
      const modified = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '';
      return `${i + 1}. **${f.name}** (${type})\n   ID: ${f.id}\n   Link: ${f.webViewLink}\n   Modified: ${modified} | Owner: ${owner}`;
    });

    return header + formatted.join('\n\n');
  } catch (error: any) {
    return `Error searching Drive: ${error.message || error}`;
  }
}

export async function gdriveGetFile(args: {
  file_id: string;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const fileId = extractFileId(args.file_id);

  try {
    const drive = google.drive({ version: 'v3', auth: getAuth() });
    const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType, size, webViewLink' });
    const mimeType = meta.data.mimeType || '';
    const name = meta.data.name || 'Untitled';

    if (mimeType === 'application/vnd.google-apps.document') {
      return gdocsRead({ document_id: fileId });
    }
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      return gsheetsRead({ spreadsheet_id: fileId });
    }
    if (mimeType === 'application/vnd.google-apps.presentation') {
      return gslidesRead({ presentation_id: fileId });
    }

    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const content = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );
      return truncate(`# ${name}\n\n${content.data}`);
    }

    return `# ${name}\nType: ${mimeType}\nLink: ${meta.data.webViewLink}\n\nThis file type cannot be read as text. Use the link to view it in your browser.`;
  } catch (error: any) {
    if (error.code === 404) return `File not found: ${fileId}`;
    if (error.code === 403) return `Access denied to file: ${fileId}.`;
    return `Error reading file: ${error.message || error}`;
  }
}

export async function gcalGetEvents(args: {
  days_back?: number;
  days_ahead?: number;
  limit?: number;
  query?: string;
}): Promise<string> {
  if (!config.google.refreshToken) {
    return 'Error: Google Workspace is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.';
  }

  const daysBack = args.days_back ?? 7;
  const daysAhead = args.days_ahead ?? 7;
  const limit = args.limit || 20;

  const now = new Date();
  const timeMin = new Date(now.getTime() - daysBack * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 86400000).toISOString();

  try {
    const calendar = google.calendar({ version: 'v3', auth: getAuth() });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
      q: args.query,
    });

    const events = response.data.items || [];
    if (events.length === 0) {
      return `No events found between ${timeMin.split('T')[0]} and ${timeMax.split('T')[0]}.`;
    }

    const header = `Found ${events.length} event(s):\n\n`;
    const formatted = events.map((e) => {
      const start = e.start?.dateTime || e.start?.date || '';
      const end = e.end?.dateTime || e.end?.date || '';
      const attendees = (e.attendees || [])
        .map((a) => a.displayName || a.email)
        .filter(Boolean)
        .join(', ');
      let entry = `**${e.summary || 'Untitled'}**\n  When: ${start} to ${end}`;
      if (attendees) entry += `\n  Attendees: ${attendees}`;
      if (e.location) entry += `\n  Location: ${e.location}`;
      if (e.htmlLink) entry += `\n  Link: ${e.htmlLink}`;
      if (e.description) {
        const desc = e.description.length > 300 ? e.description.substring(0, 300) + '...' : e.description;
        entry += `\n  Description: ${desc}`;
      }
      return entry;
    });

    return header + formatted.join('\n\n---\n\n');
  } catch (error: any) {
    return `Error fetching calendar events: ${error.message || error}`;
  }
}
