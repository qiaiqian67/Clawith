import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  completeFocus,
  createCredential,
  deleteCredential,
  listCredentials,
  createTask,
  listFocus,
  listRelationships,
  listTasks,
  readDirectory,
  triggerTask,
  updateTask,
  type AgentCredential,
  type AgentTask,
  type DirectoryPerson,
  type FocusItem,
  type RelationshipEntry,
} from '../../shared/agent-work.ts';

/**
 * What an Agent is working on, who it knows, what it keeps in view, and the
 * people it can reach.
 *
 * These four surfaces are what make an Agent a colleague: a task it can be
 * given, a relation it keeps, a focus it follows, and a directory it reads.
 */

export interface AgentWorkProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
}

type Section = 'tasks' | 'relationships' | 'focus' | 'directory' | 'credentials';

export function AgentWorkTab(props: AgentWorkProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('tasks');
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [relations, setRelations] = useState<RelationshipEntry[]>([]);
  const [focus, setFocus] = useState<FocusItem[]>([]);
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [credentials, setCredentials] = useState<AgentCredential[]>([]);
  const [credentialName, setCredentialName] = useState('');
  const [credentialValue, setCredentialValue] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [taskList, relationList, focusList, peopleList, credentialList] = await Promise.all([
      listTasks(props.baseUrl, props.token, props.agentId),
      listRelationships(props.baseUrl, props.token, props.agentId),
      listFocus(props.baseUrl, props.token, props.agentId),
      readDirectory(props.baseUrl, props.token, props.agentId),
      listCredentials(props.baseUrl, props.token, props.agentId),
    ]);
    setTasks(taskList);
    setRelations(relationList);
    setFocus(focusList);
    setPeople(peopleList);
    setCredentials(credentialList);
    setLoading(false);
  }, [props.agentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addTask = useCallback(async () => {
    const value = title.trim();
    if (!value || !props.token) return;
    setBusy(true);
    try {
      await createTask(props.baseUrl, props.token, props.agentId, { title: value });
      setTitle('');
      await load();
    } finally {
      setBusy(false);
    }
  }, [load, props, title]);

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'tasks', label: t('agentWork.tasks') },
    { id: 'relationships', label: t('agentWork.relationships') },
    { id: 'focus', label: t('agentWork.focus') },
    { id: 'directory', label: t('agentWork.directory') },
    { id: 'credentials', label: t('agentWork.credentials') },
  ];

  return (
    <section className="zx-agent-section">
      <div className="zx-agent-work-tabs">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className="zx-agent-work-tab"
            data-active={section === item.id ? 'true' : undefined}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="zx-agent-hint">{t('common.loading')}</p>
      ) : section === 'tasks' ? (
        <>
          <div className="zx-agent-work-form">
            <input
              className="zx-field-input"
              value={title}
              placeholder={t('agentWork.taskPlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTask();
              }}
            />
            <button
              type="button"
              className="zx-button-primary"
              disabled={busy || !title.trim()}
              onClick={() => void addTask()}
            >
              {t('agentWork.addTask')}
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="zx-agent-empty">{t('agentWork.noTask')}</p>
          ) : (
            <ul className="zx-agent-list">
              {tasks.map((task) => (
                <li key={task.id} className="zx-agent-item">
                  <span className="zx-agent-item-text">
                    <strong>{task.title}</strong>
                    <small>
                      {task.status}
                      {task.priority ? ` · ${task.priority}` : ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="zx-button-ghost"
                    onClick={() => {
                      if (!props.token) return;
                      void triggerTask(props.baseUrl, props.token, props.agentId, task.id);
                    }}
                  >
                    {t('agentWork.run')}
                  </button>
                  <button
                    type="button"
                    className="zx-agent-danger"
                    onClick={() => {
                      if (!props.token) return;
                      void updateTask(props.baseUrl, props.token, props.agentId, task.id, {
                        status: task.status === 'done' ? 'pending' : 'done',
                      }).then(() => load());
                    }}
                  >
                    {task.status === 'done' ? t('agentWork.reopen') : t('agentWork.done')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : section === 'relationships' ? (
        relations.length === 0 ? (
          <p className="zx-agent-empty">{t('agentWork.noRelationship')}</p>
        ) : (
          <ul className="zx-agent-list">
            {relations.map((relation) => (
              <li key={relation.id} className="zx-agent-item">
                <span className="zx-agent-item-text">
                  <strong>{relation.display_name}</strong>
                  <small>
                    {relation.role_description ?? relation.participant_type}
                    {relation.note ? ` · ${relation.note}` : ''}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : section === 'focus' ? (
        focus.length === 0 ? (
          <p className="zx-agent-empty">{t('agentWork.noFocus')}</p>
        ) : (
          <ul className="zx-agent-list">
            {focus.map((item) => (
              <li key={item.key} className="zx-agent-item">
                <span className="zx-agent-item-text">
                  <strong>{item.title}</strong>
                  <small>
                    {item.status}
                    {item.due_at ? ` · ${item.due_at}` : ''}
                  </small>
                </span>
                <button
                  type="button"
                  className="zx-button-ghost"
                  onClick={() => {
                    if (!props.token) return;
                    void completeFocus(props.baseUrl, props.token, props.agentId, item.key).then(() =>
                      load(),
                    );
                  }}
                >
                  {t('agentWork.complete')}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : section === 'directory' ? (
        people.length === 0 ? (
          <p className="zx-agent-empty">{t('agentWork.noDirectory')}</p>
        ) : (
          <ul className="zx-agent-list">
            {people.map((person) => (
              <li key={person.id} className="zx-agent-item">
                <span className="zx-agent-item-text">
                  <strong>{person.display_name}</strong>
                  <small>
                    {person.title ?? ''}
                    {person.department ? ` · ${person.department}` : ''}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div className="zx-agent-work-form">
            <input
              className="zx-field-input"
              value={credentialName}
              placeholder={t('agentWork.credentialName')}
              onChange={(event) => setCredentialName(event.target.value)}
            />
            <input
              className="zx-field-input"
              type="password"
              value={credentialValue}
              placeholder={t('agentWork.credentialValue')}
              onChange={(event) => setCredentialValue(event.target.value)}
            />
            <button
              type="button"
              className="zx-button-primary"
              disabled={busy || !credentialName.trim() || !credentialValue.trim()}
              onClick={() => {
                if (!props.token) return;
                setBusy(true);
                void createCredential(props.baseUrl, props.token, props.agentId, {
                  name: credentialName.trim(),
                  value: credentialValue.trim(),
                })
                  .then(() => {
                    setCredentialName('');
                    setCredentialValue('');
                    return load();
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {t('agentWork.addCredential')}
            </button>
          </div>
          {credentials.length === 0 ? (
            <p className="zx-agent-empty">{t('agentWork.noCredential')}</p>
          ) : (
            <ul className="zx-agent-list">
              {credentials.map((credential) => (
                <li key={credential.id} className="zx-agent-item">
                  <span className="zx-agent-item-text">
                    <strong>{credential.name}</strong>
                    <small>
                      {credential.kind ?? ''} {credential.value_masked ?? ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="zx-agent-danger"
                    onClick={() => {
                      if (!props.token) return;
                      void deleteCredential(
                        props.baseUrl,
                        props.token,
                        props.agentId,
                        credential.id,
                      ).then(() => load());
                    }}
                  >
                    {t('enterprise.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
