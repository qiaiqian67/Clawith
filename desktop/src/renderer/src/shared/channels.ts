import { apiRequest } from './http.ts';

/**
 * The channels an assistant answers on.
 *
 * A channel is a place where people talk to an assistant: WeCom, Feishu, Slack,
 * DingTalk, Discord, WhatsApp, Teams. The server owns the secrets and the
 * webhook; the client shows which channel is connected and takes the keys.
 */

/** The channels the product knows. */
export type ChannelKind =
  | 'wecom'
  | 'feishu'
  | 'slack'
  | 'dingtalk'
  | 'discord'
  | 'whatsapp'
  | 'teams'
  | 'wechat'
  | 'atlassian';

/** One channel of one assistant. */
export interface ChannelConfig {
  id: string;
  agent_id: string;
  channel_type: ChannelKind;
  is_enabled: boolean;
  /** The keys of the channel, with the secrets masked by the server. */
  config: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

/** The path of the channel of one kind. */
function pathOf(agentId: string, kind: ChannelKind): string {
  if (kind === 'wecom') return `/agents/${agentId}/wecom-channel`;
  if (kind === 'slack') return `/agents/${agentId}/slack-channel`;
  if (kind === 'atlassian') return `/agents/${agentId}/atlassian-channel`;
  return `/agents/${agentId}/channel`;
}

/** The channel of one kind, or null when it is not connected. */
export async function readChannel(
  baseUrl: string,
  token: string,
  agentId: string,
  kind: ChannelKind,
): Promise<ChannelConfig | null> {
  try {
    return await apiRequest<ChannelConfig>(`${baseUrl}${pathOf(agentId, kind)}`, { token });
  } catch {
    return null;
  }
}

/** The webhook the people of a channel call. */
export async function readWebhookUrl(
  baseUrl: string,
  token: string,
  agentId: string,
  kind: ChannelKind,
): Promise<string | null> {
  try {
    const answer = await apiRequest<{ webhook_url?: string; url?: string }>(
      `${baseUrl}${pathOf(agentId, kind)}/webhook-url`,
      { token },
    );
    return answer.webhook_url ?? answer.url ?? null;
  } catch {
    return null;
  }
}

/** Connect a channel. */
export async function configureChannel(
  baseUrl: string,
  token: string,
  agentId: string,
  kind: ChannelKind,
  config: Record<string, unknown>,
): Promise<ChannelConfig> {
  return apiRequest<ChannelConfig>(`${baseUrl}${pathOf(agentId, kind)}`, {
    token,
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/** Remove a channel. */
export async function removeChannel(
  baseUrl: string,
  token: string,
  agentId: string,
  kind: ChannelKind,
): Promise<void> {
  await apiRequest<unknown>(`${baseUrl}${pathOf(agentId, kind)}`, {
    token,
    method: 'DELETE',
  });
}

/** The test of a channel: the server sends one message and answers. */
export async function testChannel(
  baseUrl: string,
  token: string,
  agentId: string,
  kind: ChannelKind,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const answer = await apiRequest<{ ok?: boolean; detail?: string; message?: string }>(
      `${baseUrl}${pathOf(agentId, kind)}/test`,
      { token, method: 'POST', body: JSON.stringify({}) },
    );
    return { ok: answer.ok ?? true, detail: answer.detail ?? answer.message ?? '' };
  } catch (cause) {
    return {
      ok: false,
      detail: cause instanceof Error ? cause.message : 'unknown',
    };
  }
}

/** The kinds of the channels, with the name the product shows. */
export const CHANNEL_KINDS: Array<{ id: ChannelKind; label: string; hint: string }> = [
  { id: 'wecom', label: '企业微信', hint: '群机器人，或 AI 应用的回调地址。' },
  { id: 'feishu', label: '飞书', hint: '机器人的凭证，绑定后群里@它就会回答。' },
  { id: 'slack', label: 'Slack', hint: '应用的凭证，绑定后频道里@它就会回答。' },
  { id: 'dingtalk', label: '钉钉', hint: '机器人的凭证，绑定后群里@它就会回答。' },
  { id: 'discord', label: 'Discord', hint: '机器人的凭证，绑定后频道里@它就会回答。' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'WhatsApp Business 的凭证。' },
  { id: 'teams', label: 'Teams', hint: 'Microsoft Teams 的凭证。' },
  { id: 'wechat', label: '微信公众号', hint: '公众号的凭证。' },
];
