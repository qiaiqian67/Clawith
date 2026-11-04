import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listAuditLogs,
  listCompanies,
  readPlatformMetrics,
  toggleCompany,
  type AuditLogEntry,
  type Company,
  type PlatformMetrics,
} from '../../shared/admin.ts';
import { listManagedUsers, setUserQuota, setUserRole, type ManagedUser } from '../../shared/members.ts';
import { PlatformPanel } from '../platform/PlatformPanel';
import './admin.css';

/**
 * The administration of the platform and of the organization.
 *
 * A platform administrator sees every company; an organization administrator
 * sees the people of their own organization and what they may spend.
 */

export interface AdminPanelProps {
  baseUrl: string;
  token: string | null;
  /** The role of the signed-in user. */
  role: string;
}

type Tab = 'people' | 'companies' | 'audit' | 'platform';

export function AdminPanel(props: AdminPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('people');
  const [people, setPeople] = useState<ManagedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPlatformAdmin = props.role === 'platform_admin';

  const load = useCallback(async () => {
    if (!props.token) return;
    const [userList, companyList, logList, platformMetrics] = await Promise.all([
      listManagedUsers(props.baseUrl, props.token),
      isPlatformAdmin ? listCompanies(props.baseUrl, props.token) : Promise.resolve([]),
      listAuditLogs(props.baseUrl, props.token),
      isPlatformAdmin ? readPlatformMetrics(props.baseUrl, props.token) : Promise.resolve(null),
    ]);
    setPeople(userList);
    setCompanies(companyList);
    setAudit(logList);
    setMetrics(platformMetrics);
    setLoading(false);
  }, [isPlatformAdmin, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changeRole = useCallback(
    async (person: ManagedUser, role: 'member' | 'org_admin' | 'platform_admin') => {
      if (!props.token) return;
      setError(null);
      try {
        await setUserRole(props.baseUrl, props.token, person.id, role);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  const changeQuota = useCallback(
    async (person: ManagedUser, daily: string) => {
      if (!props.token) return;
      const value = daily.trim() === '' ? null : Number(daily);
      if (value !== null && (!Number.isFinite(value) || value < 0)) return;
      setError(null);
      try {
        await setUserQuota(props.baseUrl, props.token, person.id, {
          max_tokens_per_day: value,
          max_tokens_per_month: person.max_tokens_per_month,
        });
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  const flip = useCallback(
    async (company: Company) => {
      if (!props.token) return;
      await toggleCompany(props.baseUrl, props.token, company.id);
      await load();
    },
    [load, props.baseUrl, props.token],
  );

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'people', label: t('admin.people') },
    ...(isPlatformAdmin ? [{ id: 'companies' as const, label: t('admin.companies') }] : []),
    { id: 'audit', label: t('admin.audit') },
    ...(isPlatformAdmin ? [{ id: 'platform' as const, label: t('platform.title') }] : []),
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
      <header className="zx-view-head">
        <div>
          <h1 className="zx-view-title">{t('admin.title')}</h1>
          <p className="zx-view-subtitle">
            {isPlatformAdmin ? t('admin.subtitlePlatform') : t('admin.subtitleOrg')}
          </p>
        </div>
        {metrics ? (
          <div className="zx-plaza-stats">
            <span>
              <strong>{metrics.total_users}</strong> {t('admin.people')}
            </span>
            <span>
              <strong>{metrics.total_agents}</strong> {t('admin.agents')}
            </span>
            <span>
              <strong>{metrics.total_companies}</strong> {t('admin.companies')}
            </span>
          </div>
        ) : null}
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
        {error ? <p className="zx-field-error">{error}</p> : null}
        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : tab === 'people' ? (
          people.length === 0 ? (
            <p className="zx-view-empty">{t('admin.noPeople')}</p>
          ) : (
            <ul className="zx-admin-list">
              {people.map((person) => (
                <li key={person.id} className="zx-admin-row">
                  <span className="zx-admin-row-text">
                    <strong>{person.display_name}</strong>
                    <small>
                      {person.email ?? person.username ?? ''} · {person.role}
                      {person.is_active ? '' : ` · ${t('admin.inactive')}`}
                    </small>
                  </span>
                  <select
                    className="zx-admin-select"
                    value={person.role}
                    onChange={(event) =>
                      void changeRole(person, event.target.value as 'member' | 'org_admin' | 'platform_admin')
                    }
                  >
                    <option value="member">{t('admin.roleMember')}</option>
                    <option value="org_admin">{t('admin.roleOrgAdmin')}</option>
                    {isPlatformAdmin ? (
                      <option value="platform_admin">{t('admin.rolePlatformAdmin')}</option>
                    ) : null}
                  </select>
                  <input
                    className="zx-admin-quota"
                    type="number"
                    min={0}
                    placeholder={t('admin.quota')}
                    defaultValue={person.max_tokens_per_day ?? ''}
                    onBlur={(event) => void changeQuota(person, event.target.value)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : tab === 'platform' ? (
          <PlatformPanel baseUrl={props.baseUrl} token={props.token} />
        ) : tab === 'companies' ? (
          companies.length === 0 ? (
            <p className="zx-view-empty">{t('admin.noCompany')}</p>
          ) : (
            <ul className="zx-admin-list">
              {companies.map((company) => (
                <li key={company.id} className="zx-admin-row">
                  <span className="zx-admin-row-text">
                    <strong>{company.name}</strong>
                    <small>
                      {company.slug} · {company.user_count} {t('admin.people')} ·{' '}
                      {company.agent_count} {t('admin.agents')}
                    </small>
                  </span>
                  <span className="zx-admin-state" data-on={company.is_active ? 'true' : undefined}>
                    {company.is_active ? t('admin.on') : t('admin.off')}
                  </span>
                  <button type="button" className="zx-button-ghost" onClick={() => void flip(company)}>
                    {company.is_active ? t('admin.disable') : t('admin.enable')}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : audit.length === 0 ? (
          <p className="zx-view-empty">{t('admin.noAudit')}</p>
        ) : (
          <ul className="zx-admin-list">
            {audit.map((entry) => (
              <li key={entry.id} className="zx-admin-row">
                <span className="zx-admin-row-text">
                  <strong>{entry.action}</strong>
                  <small>
                    {entry.actor_name ?? entry.agent_name ?? '—'}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </small>
                </span>
                <span className="zx-admin-state">{entry.status ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
