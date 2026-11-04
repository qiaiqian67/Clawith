import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listMyTenants,
  readMyQuota,
  readMyTenant,
  readTenantUsage,
  remainingShare,
  switchTenant,
  type Tenant,
  type TenantUsage,
} from '../../shared/usage.ts';
import './usage.css';

/**
 * The quota of the organization, and the switch between organizations.
 *
 * The ring shows how much of the day is left. The list shows the
 * organizations the person is in, so they may move between them.
 */

const RING = { size: 34, stroke: 2.25 };

export interface UsagePanelProps {
  baseUrl: string;
  token: string | null;
  /** The person who is signed in. */
  userId: string | null;
  /** The organization the session is in. */
  tenantId: string | null;
  /** Called after the session moved into another organization. */
  onSwitched?: (accessToken: string) => void;
}

export function UsagePanel(props: UsagePanelProps) {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [current, setCurrent] = useState<string | null>(props.tenantId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [usageList, quota, tenantList, mine] = await Promise.all([
      readTenantUsage(props.baseUrl, props.token),
      props.userId ? readMyQuota(props.baseUrl, props.token, props.userId) : Promise.resolve(null),
      listMyTenants(props.baseUrl, props.token),
      readMyTenant(props.baseUrl, props.token),
    ]);
    setUsage(usageList);
    setLimit(quota?.max_tokens_per_day ?? null);
    setTenants(tenantList);
    setCurrent(mine?.id ?? props.tenantId);
  }, [props.baseUrl, props.token, props.tenantId, props.userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const move = useCallback(
    async (tenantId: string) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        const answer = await switchTenant(props.baseUrl, props.token, tenantId);
        const next = answer.access_token ?? answer.token;
        if (next) props.onSwitched?.(next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [props, t],
  );

  const used = usage?.today.total_tokens ?? 0;
  const share = remainingShare(used, limit);
  const radius = (RING.size - RING.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = share > 0.4 ? 'ok' : share > 0.15 ? 'warning' : 'critical';

  return (
    <div className="zx-usage">
      <section className="zx-card">
        <div className="zx-card-head">
          <h2 className="zx-card-title">{t('usage.title')}</h2>
        </div>
        <div className="zx-usage-row">
          <svg className="zx-usage-ring" viewBox={`0 0 ${RING.size} ${RING.size}`} aria-hidden="true">
            <circle
              className="zx-usage-track"
              cx={RING.size / 2}
              cy={RING.size / 2}
              r={radius}
              stroke-width={RING.stroke}
            />
            <circle
              className="zx-usage-arc"
              data-tone={tone}
              cx={RING.size / 2}
              cy={RING.size / 2}
              r={radius}
              stroke-width={RING.stroke}
              stroke-dasharray={`${circumference * share} ${circumference}`}
              transform={`rotate(-90 ${RING.size / 2} ${RING.size / 2})`}
            />
          </svg>
          <span className="zx-usage-text">
            <strong>{t('usage.today', { count: used })}</strong>
            <small>
              {limit
                ? t('usage.limit', { count: limit })
                : t('usage.noLimit')}
            </small>
          </span>
        </div>
        <div className="zx-usage-grid">
          <span className="zx-usage-cell">
            <strong>{format(usage?.month.total_tokens ?? 0)}</strong>
            <small>{t('usage.month')}</small>
          </span>
          <span className="zx-usage-cell">
            <strong>{format(usage?.total.total_tokens ?? 0)}</strong>
            <small>{t('usage.total')}</small>
          </span>
          <span className="zx-usage-cell">
            <strong>{Math.round((usage?.today.cache_hit_rate ?? 0) * 100)}%</strong>
            <small>{t('usage.cache')}</small>
          </span>
        </div>
      </section>

      {tenants.length > 1 ? (
        <section className="zx-card">
          <div className="zx-card-head">
            <h2 className="zx-card-title">{t('usage.organizations')}</h2>
          </div>
          {tenants.map((tenant) => (
            <div key={tenant.id} className="zx-row">
              <span className="zx-row-text">
                <strong>{tenant.name}</strong>
                {tenant.role ? <small>{tenant.role}</small> : null}
              </span>
              {tenant.id === current ? (
                <span className="zx-usage-current">{t('usage.current')}</span>
              ) : (
                <button
                  type="button"
                  className="zx-button-ghost"
                  disabled={busy}
                  onClick={() => void move(tenant.id)}
                >
                  {t('usage.switch')}
                </button>
              )}
            </div>
          ))}
        </section>
      ) : null}

      {error ? <p className="zx-field-error">{error}</p> : null}
    </div>
  );
}

/** A number a reader scans. */
function format(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
