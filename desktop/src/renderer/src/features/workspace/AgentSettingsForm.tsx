import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  readAgent,
  readPermissions,
  updateAgent,
  updatePermissions,
  listModels,
  type AgentPermissions,
  type AgentSummary,
  type ModelSummary,
} from '../../shared/agent-admin.ts';

/**
 * The settings of one Agent: its identity, its model, its budgets, and its
 * heartbeat.
 */

export interface AgentSettingsFormProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
  onSaved?: () => void;
}

export function AgentSettingsForm(props: AgentSettingsFormProps) {
  const { t } = useTranslation();
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [permissions, setPermissions] = useState<AgentPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.token) return;
    let cancelled = false;
    void (async () => {
      try {
        const [detail, modelList, access] = await Promise.all([
          readAgent(props.baseUrl, props.token!, props.agentId),
          listModels(props.baseUrl, props.token!),
          readPermissions(props.baseUrl, props.token!, props.agentId),
        ]);
        if (cancelled) return;
        setAgent(detail);
        setModels(modelList.filter((model) => model.enabled));
        setPermissions(access);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.agentId, props.baseUrl, props.token, t]);

  const patch = useCallback((changes: Partial<AgentSummary>) => {
    setAgent((current) => (current ? { ...current, ...changes } : current));
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    if (!agent || !props.token) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAgent(props.baseUrl, props.token, props.agentId, {
        name: agent.name,
        avatar_url: agent.avatar_url,
        role_description: agent.role_description,
        welcome_message: agent.welcome_message ?? undefined,
        primary_model_id: agent.primary_model_id,
        fallback_model_id: agent.fallback_model_id,
        context_window_size: agent.context_window_size,
        max_tokens_per_day: agent.max_tokens_per_day,
        max_tokens_per_month: agent.max_tokens_per_month,
        max_tool_rounds: agent.max_tool_rounds,
        heartbeat_enabled: agent.heartbeat_enabled,
        heartbeat_interval_minutes: agent.heartbeat_interval_minutes,
        heartbeat_active_hours: agent.heartbeat_active_hours,
      });
      setAgent(updated);
      setSaved(true);
      props.onSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setSaving(false);
    }
  }, [agent, props, t]);

  const saveAccess = useCallback(
    async (next: AgentPermissions) => {
      if (!props.token || !permissions) return;
      setSaving(true);
      setError(null);
      try {
        await updatePermissions(props.baseUrl, props.token, props.agentId, {
          scope_type: next.scope_type,
          access_level: next.access_level,
        });
        setPermissions(next);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setSaving(false);
      }
    },
    [permissions, props, t],
  );

  if (error && !agent) {
    return <p className="zx-agent-empty">{error}</p>;
  }
  if (!agent) {
    return <p className="zx-agent-empty">{t('common.loading')}</p>;
  }

  return (
    <div className="zx-agent-form">
      <div className="zx-agent-avatar-row">
        <span className="zx-agent-avatar" aria-hidden="true">
          {agent.avatar_url ? (
            <img className="zx-agent-avatar-image" src={agent.avatar_url} alt="" />
          ) : (
            agent.name.slice(0, 1)
          )}
        </span>
        <label className="zx-field zx-agent-avatar-field">
          <span className="zx-field-label">{t('agentSettings.avatar')}</span>
          <input
            className="zx-field-input"
            type="url"
            placeholder="https://…"
            value={agent.avatar_url ?? ''}
            onChange={(event) => patch({ avatar_url: event.target.value || null })}
          />
          <span className="zx-agent-hint">{t('agentSettings.avatarHint')}</span>
        </label>
      </div>

      <label className="zx-field">
        <span className="zx-field-label">{t('agentSettings.name')}</span>
        <input
          className="zx-field-input"
          value={agent.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </label>

      <label className="zx-field">
        <span className="zx-field-label">{t('agentSettings.role')}</span>
        <textarea
          className="zx-field-textarea"
          rows={3}
          value={agent.role_description}
          onChange={(event) => patch({ role_description: event.target.value })}
        />
      </label>

      <label className="zx-field">
        <span className="zx-field-label">{t('agentSettings.welcome')}</span>
        <textarea
          className="zx-field-textarea"
          rows={2}
          value={agent.welcome_message ?? ''}
          onChange={(event) => patch({ welcome_message: event.target.value })}
        />
      </label>

      <div className="zx-agent-row">
        <label className="zx-field">
          <span className="zx-field-label">{t('agentSettings.model')}</span>
          <select
            className="zx-field-input"
            value={agent.primary_model_id ?? ''}
            onChange={(event) => patch({ primary_model_id: event.target.value || null })}
          >
            <option value="">{t('agentSettings.noModel')}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} ({model.model})
              </option>
            ))}
          </select>
        </label>

        <label className="zx-field">
          <span className="zx-field-label">{t('agentSettings.fallbackModel')}</span>
          <select
            className="zx-field-input"
            value={agent.fallback_model_id ?? ''}
            onChange={(event) => patch({ fallback_model_id: event.target.value || null })}
          >
            <option value="">{t('agentSettings.noFallback')}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentSettings.budgets')}</h3>
        <div className="zx-agent-row">
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.contextWindow')}</span>
            <input
              className="zx-field-input"
              type="number"
              min={1}
              max={500}
              value={agent.context_window_size}
              onChange={(event) => patch({ context_window_size: Number(event.target.value) })}
            />
          </label>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.maxToolRounds')}</span>
            <input
              className="zx-field-input"
              type="number"
              min={5}
              max={500}
              value={agent.max_tool_rounds}
              onChange={(event) => patch({ max_tool_rounds: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="zx-agent-row">
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.maxTokensPerDay')}</span>
            <input
              className="zx-field-input"
              type="number"
              value={agent.max_tokens_per_day ?? ''}
              placeholder={t('agentSettings.unlimited')}
              onChange={(event) =>
                patch({ max_tokens_per_day: event.target.value ? Number(event.target.value) : null })
              }
            />
          </label>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.maxTokensPerMonth')}</span>
            <input
              className="zx-field-input"
              type="number"
              value={agent.max_tokens_per_month ?? ''}
              placeholder={t('agentSettings.unlimited')}
              onChange={(event) =>
                patch({ max_tokens_per_month: event.target.value ? Number(event.target.value) : null })
              }
            />
          </label>
        </div>
        <p className="zx-agent-hint">
          {t('agentSettings.usageToday', {
            today: agent.tokens_used_today,
            month: agent.tokens_used_month,
          })}
        </p>
      </div>

      <div className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentSettings.heartbeat')}</h3>
        <div className="zx-agent-row">
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.interval')}</span>
            <input
              className="zx-field-input"
              type="number"
              min={5}
              value={agent.heartbeat_interval_minutes}
              onChange={(event) => patch({ heartbeat_interval_minutes: Number(event.target.value) })}
            />
          </label>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentSettings.activeHours')}</span>
            <input
              className="zx-field-input"
              value={agent.heartbeat_active_hours}
              placeholder="09:00-18:00"
              onChange={(event) => patch({ heartbeat_active_hours: event.target.value })}
            />
          </label>
        </div>
        <div className="zx-agent-list">
          <div className="zx-agent-item">
            <span className="zx-agent-item-text">
              <strong>{t('agentSettings.heartbeatEnabled')}</strong>
              <small>{t('agentSettings.heartbeatHint')}</small>
            </span>
            <button
              type="button"
              className="zx-switch"
              data-on={agent.heartbeat_enabled ? 'true' : undefined}
              aria-pressed={agent.heartbeat_enabled}
              aria-label={t('agentSettings.heartbeatEnabled')}
              onClick={() => patch({ heartbeat_enabled: !agent.heartbeat_enabled })}
            />
          </div>
        </div>
      </div>

      {permissions ? (
        <div className="zx-agent-section">
          <h3 className="zx-agent-section-title">{t('agentSettings.access')}</h3>
          <div className="zx-agent-row">
            <label className="zx-field">
              <span className="zx-field-label">{t('agentSettings.scope')}</span>
              <select
                className="zx-field-input"
                value={permissions.scope_type}
                onChange={(event) =>
                  void saveAccess({
                    ...permissions,
                    scope_type: event.target.value as AgentPermissions['scope_type'],
                  })
                }
              >
                <option value="company">{t('agentSettings.scopeCompany')}</option>
                <option value="private">{t('agentSettings.scopePrivate')}</option>
                <option value="custom">{t('agentSettings.scopeCustom')}</option>
              </select>
            </label>
            <label className="zx-field">
              <span className="zx-field-label">{t('agentSettings.level')}</span>
              <select
                className="zx-field-input"
                value={permissions.access_level}
                onChange={(event) =>
                  void saveAccess({
                    ...permissions,
                    access_level: event.target.value as AgentPermissions['access_level'],
                  })
                }
              >
                <option value="use">{t('agentSettings.levelUse')}</option>
                <option value="manage">{t('agentSettings.levelManage')}</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {error ? <p className="zx-agent-hint" data-tone="danger">{error}</p> : null}

      <div className="zx-agent-actions">
        <button
          type="button"
          className="zx-button-primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? t('common.loading') : t('common.confirm')}
        </button>
        {saved ? <span className="zx-agent-saved">{t('agentSettings.saved')}</span> : null}
      </div>
    </div>
  );
}
