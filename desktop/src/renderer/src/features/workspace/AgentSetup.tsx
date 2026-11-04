import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listModels, listProviders, type LlmModel, type LlmProvider } from '../../shared/enterprise.ts';

/**
 * The agent form: the name, the purpose, the template, and the model.
 *
 * The templates and the models come from the server. A form with a template
 * list of its own would name a shape the organization cannot start from.
 */

/** One template the organization can start from. */
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  capability_bullets?: string[];
}

export interface AgentSetupProps {
  /** The address of the server, without the API path. */
  baseUrl: string;
  /** The access token of the session. */
  token: string | null;
  submitting: boolean;
  error: string | null;
  onCreate: (draft: {
    name: string;
    roleDescription: string;
    templateId: string | null;
    modelId: string | null;
  }) => void;
  onCancel: () => void;
}

export function AgentSetup(props: AgentSetupProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!props.token) return;
    let cancelled = false;
    void (async () => {
      const [templateList, modelList, providerList] = await Promise.all([
        fetch(`${props.baseUrl}/api/agents/templates`, {
          headers: { Authorization: `Bearer ${props.token}` },
        })
          .then((response) => (response.ok ? (response.json() as Promise<AgentTemplate[]>) : []))
          .catch(() => [] as AgentTemplate[]),
        listModels(props.baseUrl, props.token!),
        listProviders(props.baseUrl, props.token!),
      ]);
      if (cancelled) return;
      setTemplates(Array.isArray(templateList) ? templateList : []);
      setModels(modelList);
      setProviders(providerList);
      setModelId((current) => current ?? modelList.find((model) => model.is_default)?.id ?? modelList[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.baseUrl, props.token]);

  const categories = useMemo(() => {
    const seen = new Map<string, AgentTemplate[]>();
    for (const template of templates) {
      const key = template.category || t('workspace.categoryOther');
      seen.set(key, [...(seen.get(key) ?? []), template]);
    }
    return [...seen.entries()];
  }, [templates, t]);

  const canSubmit = name.trim().length > 0 && !props.submitting;

  return (
    <section className="zx-agent-setup" aria-labelledby="zx-agent-setup-title">
      <div className="zx-agent-setup-editor">
        <h1 id="zx-agent-setup-title" className="zx-agent-setup-title">
          {t('workspace.newAgent')}
        </h1>

        <label className="zx-field">
          <span className="zx-field-label">
            {t('workspace.agentName')} <em>*</em>
          </span>
          <input
            className="zx-field-input"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder={t('workspace.agentName')}
          />
        </label>

        <label className="zx-field">
          <span className="zx-field-label">{t('workspace.agentPurpose')}</span>
          <textarea
            className="zx-field-textarea"
            rows={3}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder={t('workspace.agentPurposePlaceholder')}
          />
        </label>

        <div className="zx-field">
          <span className="zx-field-label">{t('workspace.model')}</span>
          {loading ? (
            <p className="zx-agent-hint">{t('common.loading')}</p>
          ) : models.length === 0 ? (
            <div className="zx-agent-setup-missing">
              <p>{t('workspace.noModel')}</p>
              {providers.length > 0 ? (
                <p className="zx-agent-hint">
                  {t('workspace.providersAvailable')} {providers.map((provider) => provider.name).join(' · ')}
                </p>
              ) : null}
              <p className="zx-agent-hint">{t('workspace.noModelHint')}</p>
            </div>
          ) : (
            <select
              className="zx-field-input"
              value={modelId ?? ''}
              onChange={(event) => setModelId(event.target.value || null)}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label || model.model} · {model.provider}
                  {model.is_default ? ` (${t('workspace.defaultModel')})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {props.error ? <p className="zx-field-error">{props.error}</p> : null}

        <div className="zx-agent-setup-actions">
          <button type="button" className="zx-button-ghost" onClick={props.onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="zx-button-primary"
            disabled={!canSubmit}
            onClick={() =>
              props.onCreate({
                name: name.trim(),
                roleDescription: purpose.trim(),
                templateId,
                modelId,
              })
            }
          >
            {props.submitting ? t('common.loading') : t('workspace.create')}
          </button>
        </div>
      </div>

      <aside className="zx-agent-setup-suggestions" aria-labelledby="zx-suggestions-title">
        <h2 id="zx-suggestions-title">{t('workspace.recommended')}</h2>
        {templates.length === 0 ? (
          <p className="zx-agent-hint">{loading ? t('common.loading') : t('workspace.noTemplate')}</p>
        ) : (
          categories.map(([category, items]) => (
            <div key={category} className="zx-agent-setup-category">
              <span className="zx-agent-setup-category-name">{category}</span>
              <div className="zx-agent-setup-suggestion-list">
                {items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="zx-agent-setup-suggestion"
                    data-active={transactionIs(templateId, template.id)}
                    onClick={() => {
                      setTemplateId(template.id === templateId ? null : template.id);
                      if (template.name) setName(template.name);
                      if (template.description) setPurpose(template.description);
                    }}
                  >
                    <span className="zx-agent-setup-suggestion-icon" aria-hidden="true">
                      {template.icon || '◆'}
                    </span>
                    <span className="zx-agent-setup-suggestion-text">
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </aside>
    </section>
  );
}

/** Whether one template is the chosen one. */
function transactionIs(current: string | null, candidate: string): string | undefined {
  return current === candidate ? 'true' : undefined;
}
