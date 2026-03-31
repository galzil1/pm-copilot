# PM Copilot

MCP server that gives Cursor's AI access to Slack, Jira, JFrog documentation, the Artifactory codebase, Google Workspace, and Coralogix observability. Designed for JFrog Artifactory PMs to quickly draft informed responses to stakeholder inquiries.

## Supported Use Cases

- **Responding to Slack inquiries** — Feature requests, bug reports, escalations, system behavior questions, integration questions. The agent gathers context from Jira, docs, and code, then drafts a response in your voice.
- **Triaging Jira tickets** — Look up ticket details, comments, and related issues to understand priority and context before responding.
- **Researching product behavior** — Search the Artifactory codebase and documentation to understand how a feature works, verify expected behavior, or find implementation details.
- **Summarizing Slack discussions** — Read and summarize channel conversations or threads to quickly catch up on discussions you missed.
- **Reading Google Workspace documents** — Access Google Docs, Sheets, Slides, and Drive files directly from Cursor to reference one-pagers, specs, and spreadsheets.
- **Checking your calendar** — View upcoming meetings and events to find relevant context for discussions.
- **Investigating production issues** — Query Coralogix logs, traces, metrics, alerts, and incidents to diagnose problems and understand system behavior in real time.
- **Drafting with your voice** — Each user configures a personal voice/tone rule so responses match their natural communication style.

## How It Works

1. You receive a Slack inquiry (feature request, bug, escalation, integration question, etc.)
2. In Cursor chat, describe or paste the inquiry
3. Claude uses MCP tools to gather context from Jira, docs, codebase, Google Workspace
4. Claude drafts a response in your voice/tone (defined by your personal Cursor rule)
5. You review, refine, and post via the `slack_post_message` tool or copy-paste

## Available Tools

### PM Copilot (23 tools)

#### Slack
| Tool | Description |
|------|-------------|
| `slack_get_my_mentions` | Fetch recent Slack messages where you're mentioned |
| `slack_get_thread` | Get full conversation thread by channel + timestamp |
| `slack_search_messages` | Search Slack messages (supports Slack search syntax) |
| `slack_get_user_profile` | Look up a user by name or email — returns title, department, division, manager, city, and all custom profile fields |
| `slack_post_message` | Post a message to a channel/thread (requires your approval) |

#### Jira
| Tool | Description |
|------|-------------|
| `jira_search_issues` | Search Jira by keyword or JQL |
| `jira_get_issue` | Get full issue details with description and comments |
| `jira_get_issue_comments` | Get all comments on an issue |
| `jira_create_issue` | Create a new issue (Story, Bug, Task, etc.) with epic link and issue links |
| `jira_update_issue` | Update an existing issue's summary, description, or any custom field by ID |
| `jira_get_editable_fields` | Discover editable fields on an issue with their IDs, types, and allowed values |

#### JFrog Documentation
| Tool | Description |
|------|-------------|
| `docs_search` | Search JFrog official documentation across both [docs.jfrog.com](https://docs.jfrog.com/) (new) and [jfrog.com/help](https://jfrog.com/help/r/jfrog-artifactory-documentation) (legacy) |
| `docs_get_page` | Fetch and read a specific docs page (accepts URLs from either site, or a relative slug) |

#### Artifactory Codebase (Backend — `artifactory-service`)
| Tool | Description |
|------|-------------|
| `code_search` | Search the Artifactory backend codebase (Java, Groovy, configs) |
| `code_get_file` | Fetch a file or directory listing from the backend repo |

#### Artifactory MFE (Frontend — `artifactory-mfe`)
| Tool | Description |
|------|-------------|
| `mfe_code_search` | Search the Artifactory MFE frontend codebase (Vue, TypeScript, components) |
| `mfe_code_get_file` | Fetch a file or directory listing from the MFE repo |

#### Google Workspace
| Tool | Description |
|------|-------------|
| `gdocs_read` | Read a Google Doc by URL or document ID |
| `gsheets_read` | Read a Google Sheet (specific range or full spreadsheet) |
| `gslides_read` | Read a Google Slides presentation |
| `gdrive_search` | Search Google Drive by filename or content |
| `gdrive_get_file` | Read any file from Drive by URL or file ID |
| `gcal_get_events` | Get upcoming or recent calendar events |

### Coralogix (30 tools — separate MCP server)

The Coralogix integration connects via a remote MCP endpoint (not part of the pm-copilot Node process). It provides observability tools for logs, traces, metrics, alerts, incidents, and parsing rules.

| Category | Tools |
|----------|-------|
| **Logs & Traces** | `get_logs`, `get_traces`, `get_schemas` |
| **Metrics** | `metrics__list`, `metrics__metric_details`, `metrics__range_query` |
| **Alerts** | `list_alerts`, `get_alert`, `create_alert`, `update_alert`, `delete_alert`, `get_alert_event_details` |
| **Incidents** | `list_incidents`, `get_incident_details` |
| **Parsing Rules** | `list_parsing_rules`, `get_parsing_rule`, `create_parsing_rule`, `update_parsing_rule`, `delete_parsing_rule` |
| **Code Generation** | `generate_terraform_alert`, `generate_terraform_parsing_rule`, `generate_kubernetes_alert`, `generate_kubernetes_parsing_rule`, `generate_openapi_alert`, `generate_openapi_parsing_rule` |
| **Documentation** | `read_dataprime_intro_docs`, `read_metrics_guidelines`, `read_rum_log_intro_docs`, `read_rum_sdk_docs`, `alert_definition_creation_docs` |
| **Utilities** | `get_datetime` |

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
`channels:history`, `channels:read`, `chat:write`, `groups:history`, `groups:read`, `im:history`, `im:read`, `mpim:history`, `mpim:read`, `users:read`, `users:read.email`

**User Token Scopes** (already configured):
`search:read`, `channels:history`, `groups:history`, `users.profile:read`

> **Note:** The `users.profile:read` scope on the **user token** is required for `slack_get_user_profile` to return custom profile fields (department, division, manager, city, etc.). The bot token alone cannot access these fields.

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

### 6. Coralogix (per user)

Coralogix is a remote MCP server — no local code is needed. You just need an API key.

1. Log in to [Coralogix](https://dashboard.coralogix.us/) and go to **Settings > API Keys**
2. Create or copy an API key with read access to logs, traces, metrics, and alerts
3. Add the `coralogix-server` entry to your `mcp.json` (see example below)

The Coralogix MCP endpoint is region-specific. Use the URL that matches your Coralogix domain (e.g., `api.coralogix.us` for US).

### 7. Configure Cursor MCP

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
        "ARTIFACTORY_MFE_REPO": "JFROG/artifactory-mfe",
        "GOOGLE_CLIENT_ID": "your-google-client-id",
        "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
        "GOOGLE_REFRESH_TOKEN": "your-google-refresh-token"
      }
    },
    "coralogix-server": {
      "url": "https://api.coralogix.us/mgmt/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer your-coralogix-api-key"
      }
    }
  }
}
```

Restart Cursor (or reload the window) for the MCP server to be picked up.

### 8. Set Up Your Voice & Tone

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
| Coralogix API Key | — | Yes |
| Voice & Tone rule | Template in repo | Customized per person |

## Example Usage in Cursor Chat

> "I just got a message in #artifactory-support asking about remote repository cache cleanup behavior. Can you search Jira and the docs for context and draft a response?"

Claude will:
1. Use `slack_search_messages` to find the original message
2. Use `jira_search_issues` to find related tickets
3. Use `docs_search` to find relevant documentation
4. Use `code_search` and `mfe_code_search` to check the implementation across backend and frontend
5. Draft a response in your voice

> "Looks good, please post it in the thread"

Claude will use `slack_post_message` to post the approved response.

> "We're seeing 500 errors on the replication endpoint. Can you check Coralogix logs for the last hour?"

Claude will:
1. Use `get_schemas` to understand the log structure
2. Use `get_logs` with a Dataprime query filtering for 500 status codes on replication endpoints
3. Use `list_incidents` to check if any active incidents correlate
4. Summarize findings with log samples and timestamps

## Development

```bash
npm run build     # Compile TypeScript to dist/
```

The MCP server runs the compiled JavaScript from `dist/`. After making changes to TypeScript files, rebuild before restarting the MCP server.
