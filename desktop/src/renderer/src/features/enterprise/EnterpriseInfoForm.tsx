import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { readEnterpriseInfo, updateEnterpriseInfo } from '../../shared/platform-api.ts';

/**
 * The information of the organization: its name, its address, and a line
 * that describes it.
 */

export interface EnterpriseInfoFormProps {
  baseUrl: string;
  token: string | null;
}

export function EnterpriseInfoForm(props: EnterpriseInfoFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.token) return;
    const info = await readEnterpriseInfo(props.baseUrl, props.token);
    if (!info) return;
    setName(info.name ?? '');
    setDescription(info.description ?? '');
    setContactEmail(info.contact_email ?? '');
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = useCallback(async () => {
    if (!props.token) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateEnterpriseInfo(props.baseUrl, props.token, 'name', { name: name.trim() });
      await updateEnterpriseInfo(props.baseUrl, props.token, 'description', {
        description: description.trim(),
      });
      await updateEnterpriseInfo(props.baseUrl, props.token, 'contact_email', {
        contact_email: contactEmail.trim(),
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [contactEmail, description, name, props.baseUrl, props.token, t]);

  return (
    <section className="zx-enterprise-card">
      <h2 className="zx-enterprise-card-title">{t('enterprise.info')}</h2>
      <div className="zx-enterprise-form">
        <label className="zx-field">
          <span className="zx-field-label">{t('enterprise.orgName')}</span>
          <input className="zx-field-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="zx-field">
          <span className="zx-field-label">{t('enterprise.contactEmail')}</span>
          <input
            className="zx-field-input"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </label>
        <label className="zx-field">
          <span className="zx-field-label">{t('enterprise.description')}</span>
          <textarea
            className="zx-field-textarea"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      {error ? <p className="zx-field-error">{error}</p> : null}
      <div className="zx-enterprise-actions">
        {saved ? <span className="zx-agent-saved">{t('agentSettings.saved')}</span> : null}
        <button type="button" className="zx-button-primary" disabled={busy} onClick={() => void save()}>
          {busy ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </section>
  );
}
