import { WebClient } from '@slack/web-api';
import { config } from '../config';

const botClient = new WebClient(config.slack.botToken);
const userClient = new WebClient(config.slack.userToken);

interface SlackMessage {
  user: string;
  username?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  channel?: string;
  permalink?: string;
}

async function resolveUserName(userId: string): Promise<string> {
  try {
    const result = await botClient.users.info({ user: userId });
    return result.user?.real_name || result.user?.name || userId;
  } catch {
    return userId;
  }
}

async function resolveUserNames(messages: SlackMessage[]): Promise<SlackMessage[]> {
  const userIds = [...new Set(messages.map((m) => m.user).filter(Boolean))];
  const nameMap = new Map<string, string>();

  await Promise.all(
    userIds.map(async (id) => {
      nameMap.set(id, await resolveUserName(id));
    })
  );

  return messages.map((m) => ({
    ...m,
    username: nameMap.get(m.user) || m.user,
  }));
}

function formatMessages(messages: SlackMessage[]): string {
  if (messages.length === 0) return 'No messages found.';

  return messages
    .map((m) => {
      const time = new Date(parseFloat(m.ts) * 1000).toISOString();
      const author = m.username || m.user;
      const thread = m.thread_ts ? ` (thread: ${m.thread_ts})` : '';
      const channel = m.channel ? ` in #${m.channel}` : '';
      return `[${time}] ${author}${channel}${thread}:\n${m.text}`;
    })
    .join('\n\n---\n\n');
}

export async function slackGetMyMentions(args: {
  limit?: number;
}): Promise<string> {
  const limit = args.limit || 20;

  if (!config.slack.userToken) {
    return 'Error: SLACK_USER_TOKEN is not configured. User token with search:read scope is required for searching mentions.';
  }

  try {
    const result = await userClient.search.messages({
      query: 'to:me',
      sort: 'timestamp',
      sort_dir: 'desc',
      count: limit,
    });

    const matches = result.messages?.matches || [];
    const messages: SlackMessage[] = matches.map((m: any) => ({
      user: m.user || m.username || 'unknown',
      text: m.text || '',
      ts: m.ts || '',
      thread_ts: m.thread_ts,
      channel: m.channel?.name,
      permalink: m.permalink,
    }));

    const resolved = await resolveUserNames(messages);

    if (resolved.length === 0) {
      return 'No recent mentions found.';
    }

    const header = `Found ${resolved.length} recent mention(s):\n\n`;
    const formatted = resolved
      .map((m) => {
        const time = new Date(parseFloat(m.ts) * 1000).toISOString();
        const link = m.permalink ? `\nLink: ${m.permalink}` : '';
        return `[${time}] ${m.username || m.user} in #${m.channel || 'unknown'}:\n${m.text}${link}`;
      })
      .join('\n\n---\n\n');

    return header + formatted;
  } catch (error: any) {
    return `Error fetching mentions: ${error.message || error}`;
  }
}

function slackApiErrorMessage(error: unknown): string {
  const e = error as { data?: { error?: string }; message?: string };
  return e?.data?.error || e?.message || String(error);
}

export async function slackGetThread(args: {
  channel: string;
  thread_ts: string;
  limit?: number;
}): Promise<string> {
  // IMs (D…) and MPIMs (G…) are not visible to the bot unless it was invited; user token is required.
  const preferUserFirst =
    (args.channel.startsWith('D') || args.channel.startsWith('G')) && config.slack.userToken;
  const clients = preferUserFirst
    ? [userClient, botClient]
    : [botClient, ...(config.slack.userToken ? [userClient] : [])];

  let lastError = '';

  for (const client of clients) {
    try {
      const result = await client.conversations.replies({
        channel: args.channel,
        ts: args.thread_ts,
        limit: args.limit || 50,
      });

      const raw: SlackMessage[] = (result.messages || []).map((m: any) => ({
        user: m.user || 'unknown',
        text: m.text || '',
        ts: m.ts || '',
        thread_ts: m.thread_ts,
      }));

      const messages = await resolveUserNames(raw);
      return `Thread (${messages.length} messages):\n\n${formatMessages(messages)}`;
    } catch (error) {
      lastError = slackApiErrorMessage(error);
      continue;
    }
  }

  return (
    `Error fetching thread: ${lastError || 'unknown error'}. ` +
    `Channel ${args.channel}. ` +
    `For public channels invite the bot; for DMs/MPIMs the user token needs im:history / mpim:history (and a fresh OAuth after adding scopes).`
  );
}

export async function slackSearchMessages(args: {
  query: string;
  limit?: number;
}): Promise<string> {
  if (!config.slack.userToken) {
    return 'Error: SLACK_USER_TOKEN is not configured. User token with search:read scope is required.';
  }

  try {
    const result = await userClient.search.messages({
      query: args.query,
      sort: 'timestamp',
      sort_dir: 'desc',
      count: args.limit || 20,
    });

    const matches = result.messages?.matches || [];
    const messages: SlackMessage[] = matches.map((m: any) => ({
      user: m.user || m.username || 'unknown',
      text: m.text || '',
      ts: m.ts || '',
      thread_ts: m.thread_ts,
      channel: m.channel?.name,
      permalink: m.permalink,
    }));

    const resolved = await resolveUserNames(messages);

    if (resolved.length === 0) {
      return `No messages found for query: "${args.query}"`;
    }

    const header = `Found ${resolved.length} result(s) for "${args.query}":\n\n`;
    const formatted = resolved
      .map((m) => {
        const time = new Date(parseFloat(m.ts) * 1000).toISOString();
        const link = m.permalink ? `\nLink: ${m.permalink}` : '';
        return `[${time}] ${m.username || m.user} in #${m.channel || 'unknown'}:\n${m.text}${link}`;
      })
      .join('\n\n---\n\n');

    return header + formatted;
  } catch (error: any) {
    return `Error searching messages: ${error.message || error}`;
  }
}

export async function slackGetUserProfile(args: {
  name?: string;
  email?: string;
}): Promise<string> {
  if (!args.name && !args.email) {
    return 'Error: Provide at least one of "name" or "email" to look up a user.';
  }

  try {
    let userId: string | undefined;
    let userObj: any;

    if (args.email) {
      try {
        const lookup = await botClient.users.lookupByEmail({ email: args.email });
        userObj = lookup.user;
        userId = userObj?.id;
      } catch {
        return `No user found with email "${args.email}".`;
      }
    }

    if (!userId && args.name) {
      const query = args.name.toLowerCase();
      let cursor: string | undefined;
      do {
        const page: any = await botClient.users.list({ limit: 200, cursor });
        for (const member of page.members || []) {
          const real = (member.real_name || '').toLowerCase();
          const display = (member.profile?.display_name || '').toLowerCase();
          if (real.includes(query) || display.includes(query)) {
            userObj = member;
            userId = member.id;
            break;
          }
        }
        cursor = page.response_metadata?.next_cursor;
      } while (!userId && cursor);

      if (!userId) {
        return `No user found matching name "${args.name}".`;
      }
    }

    const clients = [botClient, ...(config.slack.userToken ? [userClient] : [])];

    let info: any = null;
    for (const client of clients) {
      try {
        info = await client.users.info({ user: userId! });
        if (info?.user) break;
      } catch { continue; }
    }
    if (!info?.user) return `Error: Could not fetch profile for user ${userId}.`;

    const u = info.user as any;
    let p = u.profile || {};

    for (const client of clients) {
      try {
        const full = await client.users.profile.get({ user: userId! }) as any;
        if (full?.profile) { p = { ...p, ...full.profile }; break; }
      } catch { continue; }
    }

    let teamProfile: any = null;
    for (const client of clients) {
      try {
        teamProfile = await client.team.profile.get({});
        if (teamProfile) break;
      } catch { continue; }
    }

    const fieldLabelMap = new Map<string, string>();
    const fieldTypeMap = new Map<string, string>();
    if (teamProfile) {
      for (const f of (teamProfile as any).profile?.fields || []) {
        if (f.id && f.label) fieldLabelMap.set(f.id, f.label);
        if (f.id && f.type) fieldTypeMap.set(f.id, f.type);
      }
    }

    const fields: string[] = [
      `**Name:** ${u.real_name || p.real_name || 'N/A'}`,
      `**Display Name:** ${p.display_name || 'N/A'}`,
      `**Title:** ${p.title || 'N/A'}`,
      `**Email:** ${p.email || 'N/A'}`,
      `**Phone:** ${p.phone || 'N/A'}`,
      `**Status:** ${p.status_emoji || ''} ${p.status_text || ''}`.trim(),
      `**Timezone:** ${u.tz_label || u.tz || 'N/A'}`,
      `**Is Admin:** ${u.is_admin ? 'Yes' : 'No'}`,
      `**Is Bot:** ${u.is_bot ? 'Yes' : 'No'}`,
    ];

    if (p.fields && typeof p.fields === 'object') {
      const userFieldsToResolve: { label: string; userId: string }[] = [];

      for (const [fieldId, fieldData] of Object.entries(p.fields) as [string, any][]) {
        const value = fieldData?.value;
        if (!value) continue;
        const label = fieldLabelMap.get(fieldId) || fieldData?.label || fieldId;
        const type = fieldTypeMap.get(fieldId);

        if (type === 'user' && /^U[A-Z0-9]+$/.test(value)) {
          userFieldsToResolve.push({ label, userId: value });
        } else {
          fields.push(`**${label}:** ${value}`);
        }
      }

      if (userFieldsToResolve.length > 0) {
        const resolved = await Promise.all(
          userFieldsToResolve.map(async ({ label, userId: uid }) => {
            const name = await resolveUserName(uid);
            return `**${label}:** ${name}`;
          })
        );
        fields.push(...resolved);
      }
    }

    if (u.enterprise_user) {
      const eu = u.enterprise_user;
      if (eu.enterprise_name) fields.push(`**Enterprise:** ${eu.enterprise_name}`);
    }

    return fields.join('\n');
  } catch (error: any) {
    return `Error fetching user profile: ${error.message || error}`;
  }
}

export async function slackPostMessage(args: {
  channel: string;
  text: string;
  thread_ts?: string;
}): Promise<string> {
  try {
    const result = await botClient.chat.postMessage({
      channel: args.channel,
      text: args.text,
      thread_ts: args.thread_ts,
    });

    if (result.ok) {
      const where = args.thread_ts ? ` in thread ${args.thread_ts}` : '';
      return `Message posted successfully to ${args.channel}${where}. Timestamp: ${result.ts}`;
    }

    return `Failed to post message: ${result.error || 'unknown error'}`;
  } catch (error: any) {
    return `Error posting message: ${error.message || error}`;
  }
}
