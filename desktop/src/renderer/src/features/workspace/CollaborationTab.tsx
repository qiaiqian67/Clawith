import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  delegateTask,
  handover,
  listAgentCandidates,
  listConversations,
  listConversationMessages,
  listMemberCandidates,
  listPermissionCandidates,
  type HistoryConversation,
  type MemberCandidate,
} from '../../shared/platform-api.ts';
import './collaboration.css';

/**
 * The collaboration of one assistant: the work it gives away, the people it
 * knows, and the conversations it had.
 *
 * An assistant is not alone. It hands a piece of work to another, asks
 * another for a hand, and keeps the record of what was said.
 */

export interface CollaborationTabProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
  agentName: string;
}

type Section = 'collaborators' | 'history';

export function CollaborationTab(props: CollaborationTabProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('collaborators');
  const [candidates, setCandidates] = useState<MemberCandidate[]>([]);
  const [permissionCandidates, setPermissionCandidates] = useState<MemberCandidate[]>([]);
  const [conversations, setConversations] = useState<HistoryConversation[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!props.token) return;
    const [agentList, memberList, permissionList, conversationList] = await Promise.all([
      listAgentCandidates(props.baseUrl, props.token, props.agentId),
      listMemberCandidates(props.baseUrl, props.token, props.agentId),
      listPermissionCandidates(props.baseUrl, props.token, props.agentId),
      listConversations(props.baseUrl, props.token, props.agentId),
    ]);
    setCandidates([...agentList, ...memberList]);
    setPermissionCandidates(permissionList);
    setConversations(conversationList);
    setLoading(false);
  }, [props.agentId, props.baseUrl, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const open = useCallback(
    async (conversation: HistoryConversation) => {
      if (!props.token) return;
      setSelected(conversation.id);
      const list = await listConversationMessages(
        props.baseUrl,
        props.token,
        props.agentId,
        conversation.id,
      );
      setMessages(list);
    },
    [props.agentId, props.baseUrl, props.token],
  );

  const send = useCallback(
    async (action: 'delegate' | 'handover') => {
      if (!props.token || !target || !task.trim()) return;
      setBusy(true);
      setError(null);
      setNote(null);
      try {
        if (action === 'delegate') {
          const answer = await delegateTask(props.baseUrl, props.token, props.agentId, {
            to_agent_id: target,
            task: task.trim(),
          });
          setNote(answer.message || t('collaboration.delegated'));
        } else {
          const answer = await handover(props.baseUrl, props.token, props.agentId, {
            to_agent_id: target,
            reason: task.trim(),
          });
          setNote(answer.message || t('collaboration.handedOver'));
        }
        setTask('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t('common.retry'));
      } finally {
        setBusy(false);
      }
    },
    [props.agentId, props.baseUrl, props.token, target, t, task],
  );

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'collaborators', label: t('collaboration.collaborators') },
    { id: 'history', label: t('collaboration.history') },
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

      {note ? <p className="zx-agent-saved">{note}</p> : null}
      {error ? <p className="zx-field-error">{error}</p> : null}

      {loading ? (
        <p className="zx-agent-hint">{t('common.loading')}</p>
      ) : section === 'collaborators' ? (
        <>
          <div className="zx-collaboration-form">
            <label className="zx-field">
              <span className="zx-field-label">{t('collaboration.to')}</span>
              <select
                className="zx-field-input"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">{t('collaboration.pick')}</option>
                {candidates.map((person) => (
                  <option key={`${person.participant_type}-${person.id}`} value={person.id}>
                    {person.name}
                    {person.role ? ` · ${person.role}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="zx-field">
              <span className="zx-field-label">{t('collaboration.what')}</span>
              <input
                className="zx-field-input"
                value={task}
                placeholder={t('collaboration.whatPlaceholder')}
                onChange={(event) => setTask(event.target.value)}
              />
            </label>
            <div className="zx-collaboration-actions">
              <button
                type="button"
                className="zx-button-primary"
                disabled={busy || !target || !task.trim()}
                onClick={() => void send('delegate')}
              >
                {t('collaboration.delegate')}
              </button>
              <button
                type="button"
                className="zx-button-ghost"
                disabled={busy || !target || !task.trim()}
                onClick={() => void send('handover')}
              >
                {t('collaboration.handover')}
              </button>
            </div>
          </div>

          {permissionCandidates.length > 0 ? (
            <>
              <h3 className="zx-agent-section-title">{t('collaboration.permissions')}</h3>
              <ul className="zx-agent-list">
                {permissionCandidates.map((person) => (
                  <li key={person.id} className="zx-agent-item">
                    <span className="zx-agent-item-text">
                      <strong>{person.name}</strong>
                      <small>{person.role}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : conversations.length === 0 ? (
        <p className="zx-agent-empty">{t('collaboration.noHistory')}</p>
      ) : (
        <div className="zx-collaboration-history">
          <ul className="zx-agent-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className="zx-agent-item"
                  data-active={conversation.id === selected ? 'true' : undefined}
                  onClick={() => void open(conversation)}
                >
                  <span className="zx-agent-item-text">
                    <strong>{conversation.title ?? conversation.id}</strong>
                    <small>
                      {conversation.message_count} {t('collaboration.messages')} ·{' '}
                      {conversation.last_message_at ?? ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="zx-collaboration-messages">
              {messages.length === 0 ? (
                <p className="zx-agent-empty">{t('collaboration.noMessages')}</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="zx-collaboration-message" data-role={message.role}>
                    <span className="zx-collaboration-message-role">{message.role}</span>
                    <p>{message.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
