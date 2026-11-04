import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  addModel,
  createInvitationCodes,
  listInvitationCodes,
  listMembers,
  listModels,
  listProviders,
  removeModel,
  setDefaultModel,
  type InvitationCode,
  type LlmModel,
  type LlmProvider,
  type OrgMember,
} from '../../shared/enterprise.ts';
import { InstalledToolsList } from './InstalledToolsList';
import { EnterpriseInfoForm } from './EnterpriseInfoForm';
import { UsagePanel } from '../usage/UsagePanel';
import './enterprise.css';

/**
 * The organization: the people, the models, and the invitation codes.
 *
 * A client without this screen leaves the organization unable to add a model,
 * so a new installation could not run a single agent.
 */

export interface EnterprisePanelProps {
  baseUrl: string;
  token: string | null;
  /** The person who is signed in. */
  userId?: string | null;
  /** The organization the session is in. */
  tenantId?: string | null;
}

type Tab = 'models' | 'members' | 'invitations' | 'tools' | 'info' | 'usage';

export function EnterprisePanel(props: EnterprisePanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('models');
  const [models, setModels] = useState<LlmModel[]>([]);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [provider, setProvider] = useState('');
  const [modelName, setModelName] = useState('');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');

  const load = useCallback(async () => {
    if (!props.token) return;
    const [modelList, providerList, memberList, codeList] = await Promise.all([
      listModels(props.baseUrl, props.token),
      listProviders(props.baseUrl, props.token),
      listMembers(props.baseUrl, props.token),
      listInvitationCodes(props.baseUrl, props.token),
    ]);
    setModels(modelList);
    setProviders(providerList);
    setMembers(memberList);
    setCodes(codeList);
    setProvider((current) => current || providerList[0]?.id || '');
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    // The list arrives from the server, so the state changes when the answer
    // does and not while the effect runs.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submitModel = useCallback(async () => {
    if (!props.token || !provider || !modelName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addModel(props.baseUrl, props.token, {
        provider,
        model: modelName.trim(),
        label: label.trim() || modelName.trim(),
        api_key: apiKey.trim(),
      });
      setModelName('');
      setLabel('');
      setApiKey('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [apiKey, label, load, modelName, props, provider, t]);

  const makeDefault = useCallback(
    async (model: LlmModel) => {
      if (!props.token) return;
      await setDefaultModel(props.baseUrl, props.token, model.id);
      await load();
    },
    [load, props],
  );

  const dropModel = useCallback(
    async (model: LlmModel) => {
      if (!props.token) return;
      await removeModel(props.baseUrl, props.token, model.id);
      await load();
    },
    [load, props],
  );

  const makeCodes = useCallback(async () => {
    if (!props.token) return;
    await createInvitationCodes(props.baseUrl, props.token, 5, 1);
    await load();
  }, [load, props]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'models', label: t('enterprise.models') },
    { id: 'members', label: t('enterprise.members') },
    { id: 'invitations', label: t('enterprise.invitations') },
    { id: 'tools', label: t('enterprise.tools') },
    { id: 'info', label: t('enterprise.info') },
    { id: 'usage', label: t('usage.title') },
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
      <header className="zx-view-head">
        <div>
          <h1 className="zx-view-title">{t('enterprise.title')}</h1>
          <p className="zx-view-subtitle">{t('enterprise.subtitle')}</p>
        </div>
      </header>

      <div className="zx-page-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className="zx-page-tab"
            data-active={tab === item.id ? 'true' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="zx-view-body">
        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : tab === 'models' ? (
          <>
            <section className="zx-enterprise-card">
              <h2 className="zx-enterprise-card-title">{t('enterprise.addModel')}</h2>
              <div className="zx-enterprise-form">
                <label className="zx-field">
                  <span className="zx-field-label">{t('enterprise.provider')}</span>
                  <select
                    className="zx-field-input"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                  >
                    {providers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="zx-field">
                  <span className="zx-field-label">{t('enterprise.model')}</span>
                  <input
                    className="zx-field-input"
                    value={modelName}
                    placeholder="gpt-4o / claude-sonnet-4 / deepseek-chat"
                    onChange={(event) => setModelName(event.target.value)}
                  />
                </label>
                <label className="zx-field">
                  <span className="zx-field-label">{t('enterprise.label')}</span>
                  <input
                    className="zx-field-input"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </label>
                <label className="zx-field">
                  <span className="zx-field-label">{t('enterprise.apiKey')}</span>
                  <input
                    className="zx-field-input"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </label>
              </div>
              {error ? <p className="zx-field-error">{error}</p> : null}
              <div className="zx-enterprise-actions">
                <button
                  type="button"
                  className="zx-button-primary"
                  disabled={busy || !provider || !modelName.trim()}
                  onClick={() => void submitModel()}
                >
                  {busy ? t('common.loading') : t('enterprise.add')}
                </button>
              </div>
            </section>

            {models.length === 0 ? (
              <p className="zx-view-empty">{t('enterprise.noModel')}</p>
            ) : (
              <ul className="zx-enterprise-list">
                {models.map((model) => (
                  <li key={model.id} className="zx-enterprise-row">
                    <span className="zx-enterprise-row-text">
                      <strong>
                        {model.label || model.model}
                        {model.is_default ? ` · ${t('enterprise.default')}` : ''}
                      </strong>
                      <small>
                        {model.provider} · {model.model}
                        {model.api_key_masked ? ` · ${model.api_key_masked}` : ''}
                      </small>
                    </span>
                    {!model.is_default ? (
                      <button
                        type="button"
                        className="zx-button-ghost"
                        onClick={() => void makeDefault(model)}
                      >
                        {t('enterprise.setDefault')}
                      </button>
                    ) : null}
                    <button type="button" className="zx-agent-danger" onClick={() => void dropModel(model)}>
                      {t('enterprise.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : tab === 'tools' ? (
          <InstalledToolsList baseUrl={props.baseUrl} token={props.token} />
        ) : tab === 'usage' ? (
          <UsagePanel
            baseUrl={props.baseUrl}
            token={props.token}
            userId={props.userId ?? null}
            tenantId={props.tenantId ?? null}
          />
        ) : tab === 'info' ? (
          <EnterpriseInfoForm baseUrl={props.baseUrl} token={props.token} />
        ) : tab === 'members' ? (
          members.length === 0 ? (
            <p className="zx-view-empty">{t('enterprise.noMember')}</p>
          ) : (
            <ul className="zx-enterprise-list">
              {members.map((member) => (
                <li key={member.id} className="zx-enterprise-row">
                  <span className="zx-plaza-post-author">
                    {member.avatar_url ? (
                      <img className="zx-enterprise-avatar" src={member.avatar_url} alt="" />
                    ) : (
                      (member.display_name || '?').slice(0, 1)
                    )}
                  </span>
                  <span className="zx-enterprise-row-text">
                    <strong>{member.display_name}</strong>
                    <small>
                      {member.email ?? member.username ?? ''} · {member.role}
                      {member.is_active ? '' : ` · ${t('enterprise.inactive')}`}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <div className="zx-enterprise-actions">
              <button type="button" className="zx-button-primary" onClick={() => void makeCodes()}>
                {t('enterprise.createCodes')}
              </button>
            </div>
            {codes.length === 0 ? (
              <p className="zx-view-empty">{t('enterprise.noCode')}</p>
            ) : (
              <ul className="zx-enterprise-list">
                {codes.map((code) => (
                  <li key={code.id} className="zx-enterprise-row">
                    <span className="zx-enterprise-row-text">
                      <strong className="zx-enterprise-code">{code.code}</strong>
                      <small>
                        {t('enterprise.uses', { used: code.used_count, max: code.max_uses })}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
