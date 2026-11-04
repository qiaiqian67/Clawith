import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createTask, listTasks, triggerTask, updateTask, type AgentTask } from '../../shared/agent-work.ts';
import './agent-tasks.css';

/**
 * The tasks of every assistant, in one place.
 *
 * A task belongs to one assistant, so the page picks the assistant first and
 * then shows the work it was given.
 */

export interface AgentTasksPageProps {
  baseUrl: string;
  token: string | null;
  /** Every assistant of the organization. */
  agents: Array<{ id: string; name: string }>;
  /** The assistant the page shows. */
  activeAgentId: string | null;
  onPickAgent: (agentId: string) => void;
}

export function AgentTasksPage(props: AgentTasksPageProps) {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token || !props.activeAgentId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const list = await listTasks(props.baseUrl, props.token, props.activeAgentId);
    setTasks(list);
    setLoading(false);
  }, [props.activeAgentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const add = useCallback(async () => {
    const value = title.trim();
    if (!value || !props.token || !props.activeAgentId) return;
    setBusy(true);
    try {
      await createTask(props.baseUrl, props.token, props.activeAgentId, { title: value });
      setTitle('');
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, props, title]);

  const agentName = props.agents.find((agent) => agent.id === props.activeAgentId)?.name ?? '';

  return (
    <div className="zx-view">
      <header className="zx-view-header">
        <div>
          <h1 className="zx-view-title">{t('tasks.title')}</h1>
          <p className="zx-view-subtitle">{t('tasks.subtitle')}</p>
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
        <div className="zx-agent-work-form">
          <input
            className="zx-field-input"
            value={title}
            placeholder={t('tasks.placeholder', { name: agentName })}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add();
            }}
          />
          <button
            type="button"
            className="zx-button-primary"
            disabled={busy || !title.trim() || !props.activeAgentId}
            onClick={() => void add()}
          >
            {t('tasks.add')}
          </button>
        </div>

        {loading ? (
          <p className="zx-view-empty">{t('common.loading')}</p>
        ) : tasks.length === 0 ? (
          <p className="zx-view-empty">{t('tasks.empty')}</p>
        ) : (
          <ul className="zx-tasks-list">
            {tasks.map((task) => (
              <li key={task.id} className="zx-tasks-row" data-done={task.status === 'done' ? 'true' : undefined}>
                <span className="zx-tasks-text">
                  <strong>{task.title}</strong>
                  <small>
                    {task.status}
                    {task.description ? ` · ${task.description}` : ''}
                  </small>
                </span>
                <button
                  type="button"
                  className="zx-button-ghost"
                  onClick={() => {
                    if (!props.token || !props.activeAgentId) return;
                    void triggerTask(props.baseUrl, props.token, props.activeAgentId, task.id);
                  }}
                >
                  {t('tasks.run')}
                </button>
                <button
                  type="button"
                  className="zx-agent-danger"
                  onClick={() => {
                    if (!props.token || !props.activeAgentId) return;
                    void updateTask(props.baseUrl, props.token, props.activeAgentId, task.id, {
                      status: task.status === 'done' ? 'pending' : 'done',
                    }).then(() => load());
                  }}
                >
                  {task.status === 'done' ? t('tasks.reopen') : t('tasks.done')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
