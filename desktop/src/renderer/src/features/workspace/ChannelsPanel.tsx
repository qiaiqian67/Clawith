import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHANNEL_KINDS,
  configureChannel,
  readChannel,
  readWebhookUrl,
  removeChannel,
  testChannel,
  type ChannelKind,
} from '../../shared/channels.ts';
import './channels.css';

/**
 * The channels an assistant answers on.
 *
 * A channel is a place where people talk to an assistant. The server holds
 * the secrets and calls the webhook; this screen connects the channel, shows
 * the address the people of the channel call, and lets go of it again.
 */

export interface ChannelsPanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
}

export function ChannelsPanel(props: ChannelsPanelProps) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ChannelKind>('wecom');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.token) return;
    const map: Record<string, boolean> = {};
    const urls: Record<string, string> = {};
    for (const kind of CHANNEL_KINDS) {
      const config = await readChannel(props.baseUrl, props.token, props.agentId, kind.id);
      map[kind.id] = config !== null;
      if (config) {
        const url = await readWebhookUrl(props.baseUrl, props.token, props.agentId, kind.id);
        if (url) urls[kind.id] = url;
      }
    }
    setConnected(map);
    setWebhooks(urls);
  }, [props.agentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const connect = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const config: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(keys)) {
        if (value.trim()) config[key] = value.trim();
      }
      await configureChannel(props.baseUrl, props.token, props.agentId, selected, config);
      setKeys({});
      await load();
      setNote(t('channels.connected'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [keys, load, props, selected, t]);

  const disconnect = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    try {
      await removeChannel(props.baseUrl, props.token, props.agentId, selected);
      await load();
      setNote(t('channels.disconnected'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [load, props, selected, t]);

  const check = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const answer = await testChannel(props.baseUrl, props.token, props.agentId, selected);
    if (answer.ok) setNote(answer.detail || t('channels.testOk'));
    else setError(answer.detail || t('channels.testFailed'));
    setBusy(false);
  }, [props, selected, t]);

  const kind = CHANNEL_KINDS.find((item) => item.id === selected) ?? CHANNEL_KINDS[0];
  const fields = FIELDS[selected] ?? [];

  return (
    <div className="zx-channels">
      <div className="zx-channels-list">
        {CHANNEL_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="zx-channels-item"
            data-active={item.id === selected ? 'true' : undefined}
            onClick={() => setSelected(item.id)}
          >
            <span className="zx-channels-name">{item.label}</span>
            {connected[item.id] ? (
              <span className="zx-channels-state" data-on="true">
                {t('channels.connectedBadge')}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="zx-channels-detail">
        <p className="zx-agent-hint">{kind.hint}</p>

        {connected[selected] && webhooks[selected] ? (
          <div className="zx-channels-webhook">
            <span className="zx-field-label">{t('channels.webhook')}</span>
            <code className="zx-channels-webhook-url">{webhooks[selected]}</code>
          </div>
        ) : null}

        {fields.map((field) => (
          <label key={field.key} className="zx-field">
            <span className="zx-field-label">{field.label}</span>
            <input
              className="zx-field-input"
              type={field.secret ? 'password' : 'text'}
              value={keys[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => setKeys((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}

        {note ? <p className="zx-agent-saved">{note}</p> : null}
        {error ? <p className="zx-field-error">{error}</p> : null}

        <div className="zx-agent-actions">
          <button
            type="button"
            className="zx-button-primary"
            disabled={busy}
            onClick={() => void connect()}
          >
            {connected[selected] ? t('channels.update') : t('channels.connect')}
          </button>
          {connected[selected] ? (
            <>
              <button type="button" className="zx-button-ghost" disabled={busy} onClick={() => void check()}>
                {t('channels.test')}
              </button>
              <button type="button" className="zx-agent-danger" disabled={busy} onClick={() => void disconnect()}>
                {t('channels.disconnect')}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The keys each channel asks for. */
const FIELDS: Record<string, Array<{ key: string; label: string; placeholder: string; secret?: boolean }>> = {
  wecom: [
    { key: 'corp_id', label: '企业 ID', placeholder: 'ww…' },
    { key: 'secret', label: '应用密钥', placeholder: '应用的 Secret', secret: true },
    { key: 'token', label: '回调 Token', placeholder: '回调配置里的 Token', secret: true },
    { key: 'encoding_aes_key', label: 'EncodingAESKey', placeholder: '43 位', secret: true },
  ],
  feishu: [
    { key: 'app_id', label: 'App ID', placeholder: 'cli_…' },
    { key: 'app_secret', label: 'App Secret', placeholder: '应用的 Secret', secret: true },
    { key: 'verification_token', label: '校验 Token', placeholder: '事件订阅的 Token', secret: true },
  ],
  slack: [
    { key: 'bot_token', label: 'Bot Token', placeholder: 'xoxb-…', secret: true },
    { key: 'signing_secret', label: 'Signing Secret', placeholder: '应用的签名密钥', secret: true },
  ],
  dingtalk: [
    { key: 'client_id', label: 'Client ID', placeholder: 'ding…' },
    { key: 'client_secret', label: 'Client Secret', placeholder: '应用的密钥', secret: true },
  ],
  discord: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '应用的 Token', secret: true },
  ],
  whatsapp: [
    { key: 'token', label: '访问令牌', placeholder: 'WhatsApp Business 的令牌', secret: true },
    { key: 'phone_number_id', label: '号码 ID', placeholder: '…' },
  ],
  teams: [
    { key: 'app_id', label: 'App ID', placeholder: '…' },
    { key: 'app_password', label: '应用密码', placeholder: '…', secret: true },
  ],
  wechat: [
    { key: 'app_id', label: 'App ID', placeholder: 'wx…' },
    { key: 'app_secret', label: 'App Secret', placeholder: '公众号的密钥', secret: true },
  ],
};
