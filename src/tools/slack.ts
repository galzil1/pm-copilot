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

export async function slackGetThread(args: {
  channel: string;
  thread_ts: string;
  limit?: number;
}): Promise<string> {
  const clients = [botClient, ...(config.slack.userToken ? [userClient] : [])];

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
    } catch {
      continue;
    }
  }

  return `Error fetching thread: Could not access channel ${args.channel}. The bot may need to be invited to the channel.`;
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
