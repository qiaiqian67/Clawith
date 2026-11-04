import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createSchedule,
  deleteSchedule,
  deleteTrigger,
  listSchedules,
  listTriggers,
  setScheduleEnabled,
  setTriggerEnabled,
  type AgentSchedule,
  type AgentTrigger,
} from '../../shared/agent-automation.ts';

/**
 * The automation of one Agent: its triggers and its schedules.
 */

export interface AgentAutomationPanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
}

export function AgentAutomationPanel(props: AgentAutomationPanelProps) {
  const { t } = useTranslation();
  const [triggers, setTriggers] = useState<AgentTrigger[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', instruction: '', cron_expr: '0 9 * * *' });

  const load = useCallback(async () => {
    if (!props.token) return;
    const [triggerList, scheduleList] = await Promise.all([
      listTriggers(props.baseUrl, props.token, props.agentId),
      listSchedules(props.baseUrl, props.token, props.agentId),
    ]);
    setTriggers(triggerList);
    setSchedules(scheduleList);
  }, [props.agentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleTrigger = useCallback(
    async (trigger: AgentTrigger) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await setTriggerEnabled(props.baseUrl, props.token, props.agentId, trigger.id, !trigger.is_enabled);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props, t],
  );

  const removeTrigger = useCallback(
    async (trigger: AgentTrigger) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await deleteTrigger(props.baseUrl, props.token, props.agentId, trigger.id);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props, t],
  );

  const toggleSchedule = useCallback(
    async (schedule: AgentSchedule) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await setScheduleEnabled(props.baseUrl, props.token, props.agentId, schedule.id, !schedule.is_enabled);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props, t],
  );

  const removeSchedule = useCallback(
    async (schedule: AgentSchedule) => {
      if (!props.token) return;
      setBusy(true);
      setError(null);
      try {
        await deleteSchedule(props.baseUrl, props.token, props.agentId, schedule.id);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [load, props, t],
  );

  const addSchedule = useCallback(async () => {
    if (!props.token || !form.name.trim() || !form.cron_expr.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createSchedule(props.baseUrl, props.token, props.agentId, {
        name: form.name.trim(),
        instruction: form.instruction.trim(),
        cron_expr: form.cron_expr.trim(),
      });
      setForm({ name: '', instruction: '', cron_expr: '0 9 * * *' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [form, load, props, t]);

  return (
    <div className="zx-agent-form">
      <section className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentAutomation.triggers')}</h3>
        {triggers.length === 0 ? (
          <p className="zx-agent-empty">{t('agentAutomation.noTriggers')}</p>
        ) : (
          <ul className="zx-agent-list">
            {triggers.map((trigger) => (
              <li key={trigger.id} className="zx-agent-item">
                <span className="zx-agent-item-text">
                  <strong>{trigger.name || trigger.type}</strong>
                  <small>
                    {trigger.type} · {t('agentAutomation.fired', { count: trigger.fire_count })}
                  </small>
                </span>
                <button
                  type="button"
                  className="zx-switch"
                  data-on={trigger.is_enabled ? 'true' : undefined}
                  aria-pressed={trigger.is_enabled}
                  aria-label={t('agentAutomation.toggle')}
                  disabled={busy}
                  onClick={() => void toggleTrigger(trigger)}
                />
                {trigger.is_system ? null : (
                  <button
                    type="button"
                    className="zx-agent-danger"
                    disabled={busy}
                    onClick={() => void removeTrigger(trigger)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="zx-agent-section">
        <h3 className="zx-agent-section-title">{t('agentAutomation.schedules')}</h3>
        {schedules.length === 0 ? (
          <p className="zx-agent-empty">{t('agentAutomation.noSchedules')}</p>
        ) : (
          <ul className="zx-agent-list">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="zx-agent-item">
                <span className="zx-agent-item-text">
                  <strong>{schedule.name}</strong>
                  <small>
                    {schedule.cron_expr} · {t('agentAutomation.runs', { count: schedule.run_count })}
                  </small>
                </span>
                <button
                  type="button"
                  className="zx-switch"
                  data-on={schedule.is_enabled ? 'true' : undefined}
                  aria-pressed={schedule.is_enabled}
                  aria-label={t('agentAutomation.toggle')}
                  disabled={busy}
                  onClick={() => void toggleSchedule(schedule)}
                />
                <button
                  type="button"
                  className="zx-agent-danger"
                  disabled={busy}
                  onClick={() => void removeSchedule(schedule)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="zx-agent-section">
          <span className="zx-field-label">{t('agentAutomation.newSchedule')}</span>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentAutomation.name')}</span>
            <input
              className="zx-field-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentAutomation.instruction')}</span>
            <textarea
              className="zx-field-textarea"
              rows={2}
              value={form.instruction}
              onChange={(event) => setForm({ ...form, instruction: event.target.value })}
            />
          </label>
          <label className="zx-field">
            <span className="zx-field-label">{t('agentAutomation.cron')}</span>
            <input
              className="zx-field-input"
              value={form.cron_expr}
              placeholder="0 9 * * *"
              onChange={(event) => setForm({ ...form, cron_expr: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="zx-button-primary"
            disabled={busy || !form.name.trim()}
            onClick={() => void addSchedule()}
          >
            {t('agentAutomation.addSchedule')}
          </button>
        </div>
      </section>

      {error ? <p className="zx-agent-hint" data-tone="danger">{error}</p> : null}
    </div>
  );
}
