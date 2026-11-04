import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listEntries,
  publishEntry,
  readLibraryStats,
  removeEntry,
  retireEntry,
  reviewEntry,
  type ExperienceEntry,
  type LibraryStats,
} from '../../shared/experience.ts';
import { MarkdownView } from '../workspace/MarkdownView';
import './library.css';

/**
 * The library of the organization.
 *
 * Every lesson the organization learned is here. A lesson is distilled from
 * what happened, reviewed by a person, and published so the assistants may
 * use it.
 */

export interface LibraryPanelProps {
  baseUrl: string;
  token: string | null;
  /** Whether the user may change the library. */
  canEdit: boolean;
}

export function LibraryPanel(props: LibraryPanelProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [view, setView] = useState<'team' | 'mine' | 'all'>('team');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [list, numbers] = await Promise.all([
      listEntries(props.baseUrl, props.token, { view, status }),
      readLibraryStats(props.baseUrl, props.token),
    ]);
    setEntries(list);
    setStats(numbers);
    setLoading(false);
  }, [props.baseUrl, props.token, status, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = useCallback(
    async (entry: ExperienceEntry, action: 'publish' | 'retire' | 'approve' | 'reject') => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        if (action === 'publish') await publishEntry(props.baseUrl, props.token, entry.id);
        else if (action === 'retire') await retireEntry(props.baseUrl, props.token, entry.id);
        else await reviewEntry(props.baseUrl, props.token, entry.id, action);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props.baseUrl, props.token, t],
  );

  const drop = useCallback(
    async (entry: ExperienceEntry) => {
      if (!props.token) return;
      await removeEntry(props.baseUrl, props.token, entry.id);
      await load();
    },
    [load, props.baseUrl, props.token],
  );

  const views: Array<{ id: 'team' | 'mine' | 'all'; label: string }> = [
    { id: 'team', label: t('library.team') },
    { id: 'mine', label: t('library.mine') },
    { id: 'all', label: t('library.all') },
  ];
  const statuses = [
    { id: 'all', label: t('library.all') },
    { id: 'published', label: t('library.published') },
    { id: 'draft', label: t('library.draft') },
    { id: 'retired', label: t('library.retired') },
  ];

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
        <header className="zx-view-head">
          <div>
            <h1 className="zx-view-title">
              {t('library.title')} <span>{t('library.subtitle')}</span>
            </h1>
            <p className="zx-view-subtitle">{t('library.description')}</p>
          </div>
          {stats ? (
            <div className="zx-plaza-stats">
              <span>
                <strong>{stats.total}</strong> {t('library.total')}
              </span>
              <span>
                <strong>{stats.today}</strong> {t('library.today')}
              </span>
              <span>
                <strong>{stats.cited}</strong> {t('library.cited')}
              </span>
            </div>
          ) : null}
        </header>

        <div className="zx-filters">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className="zx-filter"
              data-active={view === item.id ? 'true' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
          <span className="zx-library-divider" />
          {statuses.map((item) => (
            <button
              key={item.id}
              type="button"
              className="zx-filter"
              data-active={status === item.id ? 'true' : undefined}
              onClick={() => setStatus(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? <p className="zx-field-error">{error}</p> : null}

        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="zx-view-empty">{t('library.empty')}</p>
        ) : (
          <ul className="zx-library-list">
            {entries.map((entry) => (
              <li key={entry.id} className="zx-library-entry">
                <header className="zx-library-entry-head">
                  <button
                    type="button"
                    className="zx-library-entry-title"
                    onClick={() => setOpen(open === entry.id ? null : entry.id)}
                  >
                    {entry.title}
                  </button>
                  <span className="zx-badge" data-status={entry.status}>
                    {t(`library.status.${entry.status}`)}
                  </span>
                  <span className="zx-library-entry-origin">
                    {entry.origin_agent_name ?? entry.created_by_name ?? ''}
                  </span>
                  {props.canEdit ? (
                    <span className="zx-library-entry-actions">
                      {entry.status !== 'published' ? (
                        <button
                          type="button"
                          className="zx-button-ghost"
                          disabled={busy}
                          onClick={() => void act(entry, 'publish')}
                        >
                          {t('library.publish')}
                        </button>
                      ) : null}
                      {entry.status !== 'retired' ? (
                        <button
                          type="button"
                          className="zx-button-ghost"
                          disabled={busy}
                          onClick={() => void act(entry, 'retire')}
                        >
                          {t('library.retire')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="zx-agent-danger"
                        disabled={busy}
                        onClick={() => void drop(entry)}
                      >
                        {t('common.delete')}
                      </button>
                    </span>
                  ) : null}
                </header>
                <p className="zx-library-entry-applicability">{entry.applicability}</p>
                {open === entry.id ? (
                  <div className="zx-library-entry-body">
                    <MarkdownView content={entry.body} />
                  </div>
                ) : null}
                {entry.tags.length > 0 ? (
                  <div className="zx-library-tags">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="zx-badge">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
