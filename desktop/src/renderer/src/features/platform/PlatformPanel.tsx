import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listPlatformCompanies,
  readEnhancedMetrics,
  readLeaderboards,
  readPlatformSettings,
  togglePlatformCompany,
  updatePlatformSettings,
  type PlatformCompany,
  type PlatformMetrics,
  type PlatformSettings,
} from '../../shared/platform.ts';
import './platform.css';

/**
 * The platform, as an administrator sees it.
 *
 * The numbers of the platform, the companies on it, and the settings that
 * decide who may create one.
 */

export interface PlatformPanelProps {
  baseUrl: string;
  token: string | null;
}

export function PlatformPanel(props: PlatformPanelProps) {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [leaders, setLeaders] = useState<{ top_companies: Array<{ name: string; total_tokens: number }> } | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [companyList, metricList, leaderList, settingList] = await Promise.all([
      listPlatformCompanies(props.baseUrl, props.token),
      readEnhancedMetrics(props.baseUrl, props.token),
      readLeaderboards(props.baseUrl, props.token),
      readPlatformSettings(props.baseUrl, props.token),
    ]);
    setCompanies(companyList);
    setMetrics(metricList);
    setLeaders(leaderList);
    setSettings(settingList);
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const flip = useCallback(
    async (company: PlatformCompany) => {
      if (!props.token) return;
      setError(null);
      try {
        await togglePlatformCompany(props.baseUrl, props.token, company.id);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  const setSetting = useCallback(
    async (key: keyof PlatformSettings, value: boolean) => {
      if (!props.token) return;
      setError(null);
      try {
        await updatePlatformSettings(props.baseUrl, props.token, { [key]: value });
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  const cards = [
    {
      label: t('platform.companies'),
      value: String(companies.length),
      sub: t('platform.activeCompanies', {
        count: companies.filter((company) => company.is_active).length,
      }),
    },
    {
      label: t('platform.retention'),
      value: `${Math.round((metrics?.retention_rate_7d ?? 0) * 100)}%`,
      sub: t('platform.retentionNote', {
        count: metrics?.retained_companies ?? 0,
        total: metrics?.last_week_active_companies ?? 0,
      }),
    },
    {
      label: t('platform.tokensPerSession'),
      value: formatNumber(metrics?.avg_tokens_per_session_30d ?? 0),
      sub: t('platform.tokensPerSessionNote'),
    },
    {
      label: t('platform.people'),
      value: String(companies.reduce((total, company) => total + company.user_count, 0)),
      sub: t('platform.agents', {
        count: companies.reduce((total, company) => total + company.agent_count, 0),
      }),
    },
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
        <header className="zx-view-head">
          <div>
            <h1 className="zx-view-title">
              {t('platform.title')} <span>{t('platform.subtitle')}</span>
            </h1>
            <p className="zx-view-subtitle">{t('platform.description')}</p>
          </div>
        </header>

        {error ? <p className="zx-field-error">{error}</p> : null}

        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : (
          <>
            <div className="zx-workbench-cards">
              {cards.map((card) => (
                <div key={card.label} className="zx-workbench-card">
                  <span className="zx-workbench-card-label">{card.label}</span>
                  <span className="zx-workbench-card-value">{card.value}</span>
                  <span className="zx-workbench-card-sub">{card.sub}</span>
                </div>
              ))}
            </div>

            {settings ? (
              <section className="zx-card">
                <div className="zx-card-head">
                  <h2 className="zx-card-title">{t('platform.settings')}</h2>
                </div>
                {(
                  [
                    ['allow_self_create_company', t('platform.selfCreate')],
                    ['invitation_code_enabled', t('platform.invitationCode')],
                    ['sso_custom_domain_redirect_enabled', t('platform.ssoRedirect')],
                  ] as Array<[keyof PlatformSettings, string]>
                ).map(([key, label]) => (
                  <div key={key} className="zx-row">
                    <span className="zx-row-text">
                      <strong>{label}</strong>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings[key]}
                      aria-label={label}
                      className="zx-switch"
                      data-on={settings[key] ? 'true' : undefined}
                      onClick={() => void setSetting(key, !settings[key])}
                    />
                  </div>
                ))}
              </section>
            ) : null}

            {leaders && leaders.top_companies.length > 0 ? (
              <section className="zx-card">
                <div className="zx-card-head">
                  <h2 className="zx-card-title">{t('platform.leaders')}</h2>
                  <span className="zx-card-note">{t('platform.leadersNote')}</span>
                </div>
                {leaders.top_companies.slice(0, 8).map((row, index) => (
                  <div key={row.name} className="zx-row">
                    <span className="zx-platform-rank">{index + 1}</span>
                    <span className="zx-row-text">
                      <strong>{row.name}</strong>
                    </span>
                    <span className="zx-platform-tokens">{formatNumber(row.total_tokens)}</span>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="zx-card">
              <div className="zx-card-head">
                <h2 className="zx-card-title">{t('platform.companies')}</h2>
                <span className="zx-card-note">{companies.length}</span>
              </div>
              {companies.length === 0 ? (
                <p className="zx-view-empty">{t('platform.noCompany')}</p>
              ) : (
                companies.map((company) => (
                  <div key={company.id} className="zx-row">
                    <span className="zx-row-text">
                      <strong>{company.name}</strong>
                      <small>
                        {company.slug} · {company.user_count} {t('platform.people')} ·{' '}
                        {company.agent_count} {t('platform.agentsWord')}
                      </small>
                    </span>
                    <span className="zx-platform-tokens">{formatNumber(company.total_tokens)}</span>
                    <span className="zx-platform-state" data-on={company.is_active ? 'true' : undefined}>
                      {company.is_active ? t('platform.on') : t('platform.off')}
                    </span>
                    <button type="button" className="zx-button-ghost" onClick={() => void flip(company)}>
                      {company.is_active ? t('platform.disable') : t('platform.enable')}
                    </button>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** A number a reader scans. */
function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
