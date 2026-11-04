import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  listTriggers,
  setScheduleEnabled,
  setTriggerEnabled,
  type AgentSchedule,
  type AgentTrigger,
} from '../../shared/agent-automation.ts';
import './agent-tasks.css';

/**
 * What wakes the assistants.
 *
 * A trigger wakes one on a condition; a schedule wakes it on a clock. Both
 * belong to one assistant, so the page picks the assistant first.
 */

export interface AgentTriggersPageProps {
  baseUrl: string;
  token: string | null;
  agents: Array<{ id: string; name: string }>;
  activeAgentId: string | null;
  onPickAgent: (agentId: string) => void;
}

export function AgentTriggersPage(props: AgentTriggersPageProps) {
  const { t } = useTranslation();
  const [triggers, setTriggers] = useState<AgentTrigger[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [cron, setCron] = useState('0 9 * * 1-5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!props.token || !props.activeAgentId) {
      setTriggers([]);
      setSchedules([]);
      return;
    }
    const [triggerList, scheduleList] = await Promise.all([
      listTriggers(props.baseUrl, props.token, props.activeAgentId),
      listSchedules(props.baseUrl, props.token, props.activeAgentId),
    ]);
    setTriggers(triggerList);
    setSchedules(scheduleList);
  }, [props.activeAgentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const add = useCallback(async () => {
    if (!props.token || !props.activeAgentId || !name.trim() || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createSchedule(props.baseUrl, props.token, props.activeAgentId, {
        name: name.trim(),
        instruction: instruction.trim(),
        cron_expr: cron.trim(),
      });
      setName('');
      setInstruction('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [cron, instruction, load, name, props, t]);

  return (
    <div className="zx-view">
      <header className="zx-view-header">
        <div>
          <h1 className="zx-view-title">{t('triggers.title')}</h1>
          <p className="zx-view-subtitle">{t('triggers.subtitle')}</p>
        </div>
        <select
          className="zx-field-input zx-tasks-agent"
          value={props.activeAgentId ?? ''}
          onChange={(event) => props.onPickAgent(event.target.value)}
        >
          {props.agents.length === 0 ? <option value="">{t('tasks.noAgent')}</option> : null}
          {props.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </header>

      <div className="zx-view-body">
        <section className="zx-enterprise-card">
          <h2 className="zx-enterprise-card-title">{t('triggers.newSchedule')}</h2>
          <div className="zx-enterprise-form">
            <label className="zx-field">
              <span className="zx-field-label">{t('triggers.name')}</span>
              <input className="zx-field-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="zx-field">
              <span className="zx-field-label">{t('triggers.cron')}</span>
              <input className="zx-field-input" value={cron} onChange={(event) => setCron(event.target.value)} />
            </label>
            <label className="zx-field">
              <span className="zx-field-label">{t('triggers.instruction')}</span>
              <input
                className="zx-field-input"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
          </div>
          {error ? <p className="zx-field-error">{error}</p> : null}
          <div className="zx-enterprise-actions">
            <button
              type="button"
              className="zx-button-primary"
              disabled={busy || !name.trim() || !instruction.trim() || !props.activeAgentId}
              onClick={() => void add()}
            >
              {t('triggers.add')}
            </button>
          </div>
        </section>

        <section>
          <h2 className="zx-enterprise-card-title">{t('triggers.schedules')}</h2>
          {schedules.length === 0 ? (
            <p className="zx-view-empty">{t('triggers.noSchedule')}</p>
          ) : (
            <ul className="zx-tasks-list">
              {schedules.map((schedule) => (
                <li key={schedule.id} className="zx-tasks-row">
                  <span className="zx-tasks-text">
                    <strong>{schedule.name}</strong>
                    <small>
                      {schedule.cron_expr} · {schedule.is_enabled ? t('triggers.on') : t('triggers.off')}
                      {schedule.next_run_at ? ` · ${schedule.next_run_at}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="zx-button-ghost"
                    onClick={() => {
                      if (!props.token || !props.activeAgentId) return;
                      void setScheduleEnabled(
                        props.baseUrl,
                        props.token,
                        props.activeAgentId,
                        schedule.id,
                        !schedule.is_enabled,
                      ).then(() => load());
                    }}
                  >
                    {schedule.is_enabled ? t('triggers.disable') : t('triggers.enable')}
                  </button>
                  <button
                    type="button"
                    className="zx-agent-danger"
                    onClick={() => {
                      if (!props.token || !props.activeAgentId) return;
                      void deleteSchedule(props.baseUrl, props.token, props.activeAgentId, schedule.id).then(
                        () => load(),
                      );
                    }}
                  >
                    {t('triggers.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="zx-enterprise-card-title">{t('triggers.triggers')}</h2>
          {triggers.length === 0 ? (
            <p className="zx-view-empty">{t('triggers.noTrigger')}</p>
          ) : (
            <ul className="zx-tasks-list">
              {triggers.map((trigger) => (
                <li key={trigger.id} className="zx-tasks-row">
                  <span className="zx-tasks-text">
                    <strong>{trigger.name}</strong>
                    <small>
                      {trigger.type} · {trigger.is_enabled ? t('triggers.on') : t('triggers.off')} ·{' '}
                      {trigger.fire_count} {t('triggers.fires')}
                      {trigger.reason ? ` · ${trigger.reason}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="zx-button-ghost"
                    onClick={() => {
                      if (!props.token || !props.activeAgentId) return;
                      void setTriggerEnabled(
                        props.baseUrl,
                        props.token,
                        props.activeAgentId,
                        trigger.id,
                        !trigger.is_enabled,
                      ).then(() => load());
                    }}
                  >
                    {trigger.is_enabled ? t('triggers.disable') : t('triggers.enable')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
