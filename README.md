# PM Copilot

MCP server that gives Cursor's AI access to Slack, Jira, JFrog documentation, the Artifactory codebase, and Google Workspace. Designed for JFrog Artifactory PMs to quickly draft informed responses to stakeholder inquiries.

## Supported Use Cases

- **Responding to Slack inquiries** — Feature requests, bug reports, escalations, system behavior questions, integration questions. The agent gathers context from Jira, docs, and code, then drafts a response in your voice.
- **Triaging Jira tickets** — Look up ticket details, comments, and related issues to understand priority and context before responding.
- **Researching product behavior** — Search the Artifactory codebase and documentation to understand how a feature works, verify expected behavior, or find implementation details.
- **Summarizing Slack discussions** — Read and summarize channel conversations or threads to quickly catch up on discussions you missed.
- **Reading Google Workspace documents** — Access Google Docs, Sheets, Slides, and Drive files directly from Cursor to reference one-pagers, specs, and spreadsheets.
- **Checking your calendar** — View upcoming meetings and events to find relevant context for discussions.
- **Drafting with your voice** — Each user configures a personal voice/tone rule so responses match their natural communication style.

## How It Works

1. You receive a Slack inquiry (feature request, bug, escalation, integration question, etc.)
2. In Cursor chat, describe or paste the inquiry
3. Claude uses MCP tools to gather context from Jira, docs, codebase, Google Workspace
4. Claude drafts a response in your voice/tone (defined by your personal Cursor rule)
5. You review, refine, and post via the `slack_post_message` tool or copy-paste

## Available Tools (17)

### Slack
| Tool | Description |
|------|-------------|
| `slack_get_my_mentions` | Fetch recent Slack messages where you're mentioned |
| `slack_get_thread` | Get full conversation thread by channel + timestamp |
| `slack_search_messages` | Search Slack messages (supports Slack search syntax) |
| `slack_post_message` | Post a message to a channel/thread (requires your approval) |

### Jira
| Tool | Description |
|------|-------------|
| `jira_search_issues` | Search Jira by keyword or JQL |
| `jira_get_issue` | Get full issue details with description and comments |
| `jira_get_issue_comments` | Get all comments on an issue |

### JFrog Documentation
| Tool | Description |
|------|-------------|
| `docs_search` | Search JFrog official documentation |
| `docs_get_page` | Fetch and read a specific docs page |

### Artifactory Codebase
| Tool | Description |
|------|-------------|
| `code_search` | Search the Artifactory codebase |
| `code_get_file` | Fetch a file or directory listing from the repo |

### Google Workspace
| Tool | Description |
|------|-------------|
| `gdocs_read` | Read a Google Doc by URL or document ID |
| `gsheets_read` | Read a Google Sheet (specific range or full spreadsheet) |
| `gslides_read` | Read a Google Slides presentation |
| `gdrive_search` | Search Google Drive by filename or content |
| `gdrive_get_file` | Read any file from Drive by URL or file ID |
| `gcal_get_events` | Get upcoming or recent calendar events |

## Setup for New Team Members

### Prerequisites

- **Node.js** v18+
- **Cursor** IDE with MCP support

### 1. Clone and Install

```bash
git clone https://github.com/galzil1/pm-copilot.git
cd pm-copilot
npm install
npm run build
```

### 2. Slack — Reuse the Existing App

A Slack app named **PM Copilot** already exists in the JFrog workspace. You do **not** need to create a new one.

**What you need:**
- Ask @galzi to add you as a collaborator on the Slack app, or get the Bot Token from the team.
- Generate your own **User OAuth Token** (this is unique per person):

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and select the **PM Copilot** app
2. Go to **OAuth & Permissions**
3. The **Bot User OAuth Token** (`xoxb-...`) is shared across the team. Copy it.
4. For the **User OAuth Token** (`xoxp-...`), you need to reinstall the app to your workspace under your own authorization. This gives you a personal user token that searches Slack as *you*.

**Bot Token Scopes** (already configured):
`channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:read`, `mpim:history`, `mpim:read`, `users:read`

**User Token Scopes** (already configured):
`search:read`, `channels:history`, `groups:history`

### 3. Jira API Token (per user)

Each team member creates their own token:

1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**, label it "PM Copilot"
3. Copy the token

### 4. GitHub Enterprise PAT (per user)

Each team member creates their own classic PAT:

1. Go to [github.jfrog.info/settings/tokens](https://github.jfrog.info/settings/tokens)
2. Click **Generate new token** > **Generate new token (classic)**
3. Select the `repo` scope
4. Copy the token

### 5. Google Workspace (per user, optional)

Requires a Google Cloud project with OAuth 2.0 credentials. See the setup steps in `.env.example`.

Once you have a Client ID and Client Secret:

```bash
node dist/google-auth.js --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

Follow the browser prompt to authorize, then copy the refresh token.

### 6. Configure Cursor MCP

Create or edit `.cursor/mcp.json` in your **workspace root** (not inside pm-copilot):

```json
{
  "mcpServers": {
    "pm-copilot": {
      "command": "node",
      "args": ["/absolute/path/to/pm-copilot/dist/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-shared-bot-token",
        "SLACK_USER_TOKEN": "xoxp-your-personal-user-token",
        "JIRA_HOST": "https://jfrog-int.atlassian.net",
        "JIRA_EMAIL": "your-email@jfrog.com",
        "JIRA_API_TOKEN": "your-jira-token",
        "GITHUB_ENTERPRISE_URL": "https://github.jfrog.info",
        "GITHUB_ENTERPRISE_TOKEN": "your-github-pat",
        "ARTIFACTORY_REPO": "JFROG/artifactory-service",
        "GOOGLE_CLIENT_ID": "your-google-client-id",
        "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-google-refresh-token"
      }
    }
  }
}
```

Restart Cursor (or reload the window) for the MCP server to be picked up.

### 7. Set Up Your Voice & Tone

Each team member should create their own voice/tone rule so Claude drafts in *their* style.

1. Copy the template:
   ```bash
   cp pm-copilot/voice-tone-template.mdc /path/to/your/workspace/.cursor/rules/pm-voice.mdc
   ```
2. Edit the file to match your communication style
3. Refine iteratively by giving Claude feedback on drafts ("too formal", "more empathy", etc.)

The rule is applied per-user and is **not** checked into git.

## What's Shared vs. Per-User

| Item | Shared | Per-User |
|------|--------|----------|
| PM Copilot codebase | Yes | — |
| Slack Bot Token (`xoxb-`) | Yes (same app) | — |
| Slack User Token (`xoxp-`) | — | Yes (your identity) |
| Jira API Token | — | Yes |
| GitHub PAT | — | Yes |
| Google OAuth Credentials | — | Yes |
| Voice & Tone rule | Template in repo | Customized per person |

## Example Usage in Cursor Chat

> "I just got a message in #artifactory-support asking about remote repository cache cleanup behavior. Can you search Jira and the docs for context and draft a response?"

Claude will:
1. Use `slack_search_messages` to find the original message
2. Use `jira_search_issues` to find related tickets
3. Use `docs_search` to find relevant documentation
4. Use `code_search` to check the implementation if needed
5. Draft a response in your voice

> "Looks good, please post it in the thread"

Claude will use `slack_post_message` to post the approved response.

## Development

```bash
npm run build     # Compile TypeScript to dist/
```

The MCP server runs the compiled JavaScript from `dist/`. After making changes to TypeScript files, rebuild before restarting the MCP server.
