import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  deleteObjective,
  listObjectives,
  updateKeyResultProgress,
  createObjective,
  progressOf,
  type Objective,
} from '../../shared/okr.ts';
import './okr.css';

/**
 * The OKR of the organization.
 *
 * An objective names what the organization wants this period. A key result
 * names how it knows, and moves as the work moves.
 */

export interface OkrPanelProps {
  baseUrl: string;
  token: string | null;
  /** Whether the user may write. */
  canEdit: boolean;
}

export function OkrPanel(props: OkrPanelProps) {
  const { t } = useTranslation();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [periodStart, setPeriodStart] = useState(startOfQuarter(0));
  const [periodEnd, setPeriodEnd] = useState(endOfQuarter(0));

  const load = useCallback(async () => {
    if (!props.token) return;
    const list = await listObjectives(props.baseUrl, props.token);
    setObjectives(list);
    setLoading(false);
  }, [props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const create = useCallback(async () => {
    if (!props.token || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createObjective(props.baseUrl, props.token, {
        title: title.trim(),
        description: description.trim() || undefined,
        period_start: periodStart,
        period_end: periodEnd,
      });
      setTitle('');
      setDescription('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [description, load, periodEnd, periodStart, props, t, title]);

  const drop = useCallback(
    async (objective: Objective) => {
      if (!props.token) return;
      await deleteObjective(props.baseUrl, props.token, objective.id);
      await load();
    },
    [load, props],
  );

  const moveKeyResult = useCallback(
    async (keyResultId: string, current: number, target: number) => {
      if (!props.token) return;
      const next = Math.min(target, Math.max(0, current + stepFor(target)));
      await updateKeyResultProgress(props.baseUrl, props.token, keyResultId, next);
      await load();
    },
    [load, props],
  );

  return (
    <div className="zx-view">
      <div className="zx-view-scroll">
      <header className="zx-view-head">
        <div>
          <h1 className="zx-view-title">{t('okr.title')}</h1>
          <p className="zx-view-subtitle">{t('okr.subtitle')}</p>
        </div>
        <span className="zx-okr-period">
          {periodStart} → {periodEnd}
        </span>
      </header>

      <div className="zx-view-body">
        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : (
          <>
            {props.canEdit ? (
              <section className="zx-okr-composer">
                <div className="zx-okr-composer-row">
                  <label className="zx-field">
                    <span className="zx-field-label">{t('okr.objective')}</span>
                    <input
                      className="zx-field-input"
                      value={title}
                      placeholder={t('okr.objectivePlaceholder')}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                  <label className="zx-field">
                    <span className="zx-field-label">{t('okr.from')}</span>
                    <input
                      className="zx-field-input"
                      type="date"
                      value={periodStart}
                      onChange={(event) => setPeriodStart(event.target.value)}
                    />
                  </label>
                  <label className="zx-field">
                    <span className="zx-field-label">{t('okr.to')}</span>
                    <input
                      className="zx-field-input"
                      type="date"
                      value={periodEnd}
                      onChange={(event) => setPeriodEnd(event.target.value)}
                    />
                  </label>
                </div>
                <label className="zx-field">
                  <span className="zx-field-label">{t('okr.description')}</span>
                  <textarea
                    className="zx-field-textarea"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                {error ? <p className="zx-field-error">{error}</p> : null}
                <div className="zx-okr-composer-actions">
                  <button
                    type="button"
                    className="zx-button-primary"
                    disabled={busy || !title.trim()}
                    onClick={() => void create()}
                  >
                    {busy ? t('common.loading') : t('okr.addObjective')}
                  </button>
                </div>
              </section>
            ) : null}

            {objectives.length === 0 ? (
              <p className="zx-view-empty">{t('okr.empty')}</p>
            ) : (
              <ul className="zx-okr-list">
                {objectives.map((objective) => {
                  const average = averageProgress(objective);
                  return (
                    <li key={objective.id} className="zx-okr-objective">
                      <header className="zx-okr-objective-head">
                        <div className="zx-okr-objective-text">
                          <strong>{objective.title}</strong>
                          <small>
                            {objective.owner_name
                              ? `${objective.owner_name} · `
                              : `${t('okr.company')} · `}
                            {objective.status} · {objective.period_start} → {objective.period_end}
                          </small>
                        </div>
                        <div className="zx-okr-progress" aria-label={t('okr.progress')}>
                          <span className="zx-okr-progress-bar">
                            <span
                              className="zx-okr-progress-fill"
                              style={{ width: `${Math.round(average * 100)}%` }}
                            />
                          </span>
                          <span className="zx-okr-progress-value">
                            {Math.round(average * 100)}%
                          </span>
                        </div>
                        {props.canEdit ? (
                          <button
                            type="button"
                            className="zx-agent-danger"
                            onClick={() => void drop(objective)}
                          >
                            {t('okr.remove')}
                          </button>
                        ) : null}
                      </header>
                      {objective.description ? (
                        <p className="zx-okr-description">{objective.description}</p>
                      ) : null}
                      {objective.key_results.length === 0 ? (
                        <p className="zx-agent-hint">{t('okr.noKeyResult')}</p>
                      ) : (
                        <ul className="zx-okr-key-results">
                          {objective.key_results.map((keyResult) => (
                            <li key={keyResult.id}>
                              <span className="zx-okr-key-title">{keyResult.title}</span>
                              <span className="zx-okr-key-value">
                                {keyResult.current_value} / {keyResult.target_value}
                                {keyResult.unit ? ` ${keyResult.unit}` : ''}
                              </span>
                              <span className="zx-okr-key-bar">
                                <span
                                  className="zx-okr-progress-fill"
                                  style={{ width: `${Math.round(progressOf(keyResult) * 100)}%` }}
                                />
                              </span>
                              {props.canEdit ? (
                                <button
                                  type="button"
                                  className="zx-okr-bump"
                                  onClick={() =>
                                    void moveKeyResult(
                                      keyResult.id,
                                      keyResult.current_value,
                                      keyResult.target_value,
                                    )
                                  }
                                >
                                  +
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/** The average of the key results of one objective. */
function averageProgress(objective: Objective): number {
  if (objective.key_results.length === 0) return 0;
  const sum = objective.key_results.reduce((total, item) => total + progressOf(item), 0);
  return sum / objective.key_results.length;
}

/** How far one press moves a key result. */
function stepFor(target: number): number {
  if (target <= 5) return 1;
  if (target <= 100) return Math.max(1, Math.round(target / 20));
  return Math.max(1, Math.round(target / 10));
}

/** The first day of the quarter of a date. */
function startOfQuarter(offset: number): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + offset;
  const year = now.getFullYear() + Math.floor(quarter / 4);
  const month = ((quarter % 4) + 4) % 4 * 3;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/** The last day of the quarter of a date. */
function endOfQuarter(offset: number): string {
  const start = new Date(`${startOfQuarter(offset)}T00:00:00Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0))
    .toISOString()
    .slice(0, 10);
}
