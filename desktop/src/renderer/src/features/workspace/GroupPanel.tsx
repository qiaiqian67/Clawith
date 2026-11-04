import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listGroupMessages,
  listGroupSessions,
  sendGroupMessage,
  type Group,
  type GroupMessage,
  type GroupSession,
} from '../../shared/groups.ts';
import { GroupSocket, type GroupSocketState } from '../../shared/group-socket.ts';
import { MarkdownView } from './MarkdownView';
import { GroupRoster } from './GroupMembers';
import { messageImages, stripImageMarkers } from '../../shared/message-images.ts';
import './group-panel.css';
import './message-images.css';

/**
 * The conversation of one group.
 *
 * The server owns the messages. The client reads them, receives the new ones
 * on the socket, and sends its own.
 */

export interface GroupPanelProps {
  serverUrl: string;
  token: string | null;
  group: Group | null;
}

const EMPTY_STATE: GroupSocketState = { connected: false, reconnecting: false };

export function GroupPanel(props: GroupPanelProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [socketState, setSocketState] = useState<GroupSocketState>(EMPTY_STATE);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const groupId = props.group?.id ?? null;

  // The sessions of the group. The primary session is the one the panel
  // opens with.
  useEffect(() => {
    if (!groupId || !props.token) return;
    const token = props.token;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listGroupSessions(props.serverUrl, token, groupId);
        if (cancelled) return;
        setSessions(list);
        setActiveSessionId((current) => {
          if (current && list.some((session) => session.id === current)) return current;
          const primary = list.find((session) => session.is_primary);
          return primary?.id ?? list[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, props.serverUrl, props.token]);

  // The messages of the active session, and the socket of the group.
  useEffect(() => {
    if (!groupId || !props.token || !activeSessionId) return;
    let cancelled = false;

    const token = props.token;
    void (async () => {
      const list = await listGroupMessages(
        props.serverUrl,
        token,
        groupId,
        activeSessionId,
      );
      if (cancelled) return;
      setMessages(list);
    })();

    const socket = new GroupSocket({
      url: `${props.serverUrl.replace(/^http/, 'ws')}/ws/group/${groupId}`,
      token: props.token,
      groupId,
      handlers: {
        onMessage: (message) => {
          if (message.id) {
            setMessages((current) =>
              current.some((item) => item.id === message.id) ? current : [...current, message],
            );
          }
        },
        onState: setSocketState,
      },
    });
    socket.open();

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [activeSessionId, groupId, props.serverUrl, props.token]);

  const submit = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (!props.token || !groupId || !activeSessionId) return;
    setSending(true);
    setError(null);
    try {
      const intake = await sendGroupMessage(
        props.serverUrl,
        props.token,
        groupId,
        activeSessionId,
        content,
      );
      setMessages((current) =>
        current.some((item) => item.id === intake.message.id)
          ? current
          : [...current, intake.message],
      );
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setSending(false);
    }
  }, [activeSessionId, draft, groupId, props, sending, t]);

  if (!props.group) {
    return <div className="zx-group-empty">{t('group.empty')}</div>;
  }

  return (
    <div className="zx-group">
      <header className="zx-group-header">
        <h1 className="zx-group-title">{props.group.name}</h1>
        <span className="zx-group-state" data-online={socketState.connected ? 'true' : undefined}>
          {socketState.reconnecting ? t('chat.reconnecting') : ''}
        </span>
      </header>

      <GroupRoster
        serverUrl={props.serverUrl}
        token={props.token}
        groupId={props.group.id}
      />

      {sessions.length > 1 ? (
        <div className="zx-group-sessions">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="zx-group-session"
              data-active={session.id === activeSessionId ? 'true' : undefined}
              onClick={() => setActiveSessionId(session.id)}
            >
              {session.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="zx-group-list">
        {messages.length === 0 ? (
          <p className="zx-group-empty">{t('group.noMessages')}</p>
        ) : (
          messages.map((message) => <GroupMessageRow key={message.id} message={message} />)
        )}
      </div>

      {error ? <p className="zx-group-error">{error}</p> : null}

      <div className="zx-composer">
        <textarea
          className="zx-composer-input"
          rows={2}
          value={draft}
          placeholder={t('group.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          className="zx-composer-button"
          disabled={!draft.trim() || sending}
          onClick={() => void submit()}
        >
          {sending ? t('common.loading') : t('chat.send')}
        </button>
      </div>
    </div>
  );
}

function GroupMessageRow(props: { message: GroupMessage }) {
  const { message } = props;
  const images = messageImages(message.content);
  const text = stripImageMarkers(message.content);
  const isOwn = message.role === 'user';

  return (
    <div className="zx-group-turn" data-role={message.role}>
      {message.sender_name ? (
        <span className="zx-group-sender">{message.sender_name}</span>
      ) : null}
      <div className="zx-group-bubble">
        {images.length > 0 ? (
          <div className="zx-message-images">
            {images.map((image, index) => (
              <img key={index} className="zx-message-image" src={image.src} alt={image.mimeType} />
            ))}
          </div>
        ) : null}
        {isOwn ? text : <MarkdownView content={text} />}
      </div>
    </div>
  );
}
