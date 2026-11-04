import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { readOrgStats, readTokenUsage, type OrgStats, type TokenUsage } from '../../shared/dashboard.ts';
import { listModels, type LlmModel } from '../../shared/enterprise.ts';
import { listNotifications, type Notification } from '../../shared/notifications.ts';
import { listAgents } from '../../shared/agents.ts';
import './dashboard.css';

/**
 * The workbench: the state of the organization at a glance.
 *
 * Four numbers answer the first question, a table names every assistant and
 * what it cost, and the activity below says what happened last.
 */

export interface DashboardPanelProps {
  baseUrl: string;
  token: string | null;
  /** The name of the signed-in user. */
  accountName: string | null;
  /** Open one of the other views. */
  onGo: (view: 'agents' | 'plaza' | 'messages' | 'enterprise' | 'okr') => void;
  /** Open one assistant. */
  onOpenAgent: (agentId: string) => void;
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string;
  tokensToday: number;
  tokenLimit: number | null;
  lastActivity: string;
}

export function DashboardPanel(props: DashboardPanelProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [notices, setNotices] = useState<Notification[]>([]);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [orgStats, tokenUsage, modelList, noticeList, agentList] = await Promise.all([
      readOrgStats(props.baseUrl, props.token),
      readTokenUsage(props.baseUrl, props.token),
      listModels(props.baseUrl, props.token),
      listNotifications(props.baseUrl, props.token, { limit: 20 }),
      listAgents(props.baseUrl, props.token),
    ]);
    setStats(orgStats);
    setUsage(tokenUsage);
    setModels(modelList);
    setNotices(noticeList);
    setRows(
      agentList.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role_description ?? '',
        status: agent.status ?? 'idle',
        tokensToday: agent.tokens_used_today ?? 0,
        tokenLimit: agent.max_tokens_per_day ?? null,
        lastActivity: agent.created_at ? formatDay(agent.created_at) : '—',
      })),
    );
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const greeting = greetingOf();
  const limited = rows.filter((row) => row.tokenLimit !== null && row.tokenLimit > 0).length;

  const cards = [
    {
      id: 'employees',
      label: t('dashboard.agents'),
      value: stats ? String(stats.total_agents) : '—',
      sub: stats ? t('dashboard.running', { count: stats.running_agents }) : t('dashboard.forAdmin'),
      view: 'agents' as const,
    },
    {
      id: 'running',
      label: t('dashboard.approvals'),
      value: stats ? String(stats.pending_approvals) : '—',
      sub: stats ? t('dashboard.approvalsNote') : t('dashboard.forAdmin'),
      view: 'messages' as const,
    },
    {
      id: 'tokens',
      label: t('dashboard.tokensToday'),
      value: formatTokens(usage?.today.total_tokens ?? 0),
      sub: t('dashboard.cacheHit', { percent: Math.round((usage?.today.cache_hit_rate ?? 0) * 100) }),
      view: 'agents' as const,
    },
    {
      id: 'quota',
      label: t('dashboard.limited'),
      value: String(limited),
      sub: t('dashboard.limitedNote', { count: rows.length - limited }),
      view: 'agents' as const,
    },
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
        <header className="zx-workbench-head">
          <h1 className="zx-workbench-title">
            <span aria-hidden="true">{greeting.mark}</span>
            {greeting.text}
          </h1>
          <p className="zx-workbench-sub">{t('dashboard.welcome', { name: props.accountName ?? '' })}</p>
        </header>

        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : (
          <>
            <div className="zx-workbench-cards">
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="zx-workbench-card"
                  onClick={() => props.onGo(card.view)}
                >
                  <span className="zx-workbench-card-label">{card.label}</span>
                  <span className="zx-workbench-card-value">{card.value}</span>
                  <span className="zx-workbench-card-sub">{card.sub}</span>
                </button>
              ))}
            </div>

            <section className="zx-card zx-workbench-table">
              <div className="zx-card-head">
                <h2 className="zx-card-title">{t('dashboard.staff')}</h2>
                <button type="button" className="zx-card-note" onClick={() => props.onGo('agents')}>
                  {t('dashboard.manage')} ›
                </button>
              </div>
              {rows.length === 0 ? (
                <p className="zx-view-empty">{t('dashboard.noStaff')}</p>
              ) : (
                <div className="zx-workbench-rows">
                  {rows.map((row) => {
                    const percent =
                      row.tokenLimit && row.tokenLimit > 0
                        ? Math.min(100, Math.round((row.tokensToday / row.tokenLimit) * 100))
                        : null;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className="zx-workbench-row"
                        onClick={() => props.onOpenAgent(row.id)}
                      >
                        <span className="zx-workbench-staff">
                          <span className="zx-avatar">{row.name.slice(0, 1)}</span>
                          <span className="zx-workbench-staff-text">
                            <span className="zx-workbench-staff-name">
                              {row.name}
                              <span className="zx-workbench-state" data-state={row.status}>
                                {t(`dashboard.state.${row.status}`)}
                              </span>
                            </span>
                            <span className="zx-workbench-staff-role">{row.role}</span>
                          </span>
                        </span>
                        <span className="zx-workbench-usage">
                          <span className="zx-workbench-usage-value">
                            {formatTokens(row.tokensToday)}
                            <span className="zx-workbench-usage-limit">
                              / {row.tokenLimit ? formatTokens(row.tokenLimit) : '∞'}
                            </span>
                          </span>
                          {percent === null ? (
                            <span className="zx-workbench-usage-note">{t('dashboard.noLimit')}</span>
                          ) : (
                            <span className="zx-workbench-usage-bar">
                              <span
                                className="zx-bar-fill"
                                data-warn={percent >= 80 ? 'true' : undefined}
                                style={{ width: `${Math.max(percent, 2)}%` }}
                              />
                            </span>
                          )}
                        </span>
                        <span className="zx-workbench-activity">{row.lastActivity}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="zx-card zx-workbench-activity">
              <div className="zx-card-head">
                <h2 className="zx-card-title">{t('dashboard.activity')}</h2>
                <span className="zx-card-note">{t('dashboard.activityCount', { count: notices.length })}</span>
              </div>
              {notices.length === 0 ? (
                <p className="zx-view-empty">{t('dashboard.noNotice')}</p>
              ) : (
                <div>
                  {notices.map((notice) => (
                    <div key={notice.id} className="zx-workbench-activity-row">
                      <span className="zx-workbench-activity-time">{formatClock(notice.created_at)}</span>
                      <span className="zx-badge">{t(`dashboard.kind.${notice.type}`)}</span>
                      <span className="zx-workbench-activity-text">{notice.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="zx-card">
              <div className="zx-card-head">
                <h2 className="zx-card-title">{t('dashboard.models')}</h2>
                <button type="button" className="zx-card-note" onClick={() => props.onGo('enterprise')}>
                  {t('dashboard.manage')} ›
                </button>
              </div>
              {models.length === 0 ? (
                <p className="zx-view-empty">{t('dashboard.noModel')}</p>
              ) : (
                <div>
                  {models.map((model) => (
                    <div key={model.id} className="zx-row">
                      <span className="zx-row-text">
                        <strong>{model.label || model.model}</strong>
                        <small>
                          {model.provider} · {model.model}
                        </small>
                      </span>
                      {model.is_default ? <span className="zx-badge">{t('dashboard.default')}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="zx-workbench-foot">{t('dashboard.refreshNote')}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** The greeting of the hour. */
function greetingOf(): { mark: string; text: string } {
  const hour = new Date().getHours();
  if (hour < 6) return { mark: '🌙', text: '夜深了' };
  if (hour < 12) return { mark: '🌅', text: '早上好' };
  if (hour < 18) return { mark: '☀️', text: '下午好' };
  return { mark: '🌇', text: '晚上好' };
}

/** A number a reader scans. */
function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/** The day a thing happened. */
function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

/** The hour a thing happened. */
function formatClock(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
