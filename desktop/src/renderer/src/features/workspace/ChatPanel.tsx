import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChatTurn } from '../../shared/use-chat';
import { useChat } from '../../shared/use-chat';
import { MarkdownView } from './MarkdownView';
import { AttachmentPicker } from './AttachmentPicker';
import { useAttachments, type Attachment } from '../../shared/use-attachments.ts';
import { messageImages, stripImageMarkers } from '../../shared/message-images';
import './chat-panel.css';
import './message-images.css';

/**
 * The chat of one session.
 *
 * The message list scrolls to the newest turn, and the composer sends what
 * the user typed. A Run in flight replaces the send button with a stop
 * button.
 */

export interface ChatPanelProps {
  serverUrl: string;
  token: string | null;
  agentId: string | null;
  sessionId: string | null;
  language?: string;
  /** The name of the agent, for the header and the settings panel. */
  agentName?: string;
  /** Open the panel of this agent. */
  onOpenPanel?: () => void;
  /** Start a new session of this agent. */
  onCreateSession?: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const { t } = useTranslation();
  const chat = useChat({
    serverUrl: props.serverUrl,
    token: props.token,
    agentId: props.agentId,
    sessionId: props.sessionId,
    language: props.language,
    agentName: props.agentName,
  });
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dropping, setDropping] = useState(false);
  const [query, setQuery] = useState('');
  const uploads = useAttachments({
    baseUrl: props.serverUrl,
    token: props.token,
    agentId: props.agentId,
    attachments,
    onChange: setAttachments,
  });
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [chat.turns.length]);

  // The search narrows the turns that are drawn. The index stays the index of
  // the whole list, so a key stays stable while the search changes.
  const visibleTurns = useMemo(() => {
    const indexed = chat.turns.map((turn, index) => ({ turn, index }));
    const needle = query.trim().toLowerCase();
    if (!needle) return indexed;
    return indexed.filter(({ turn }) => turnText(turn).toLowerCase().includes(needle));
  }, [chat.turns, query]);

  const copyTurn = useCallback(
    (turn: ChatTurn) => {
      const text = turnText(turn);
      if (!text) return;
      void navigator.clipboard?.writeText(text);
    },
    [],
  );

  const submit = useCallback(() => {
    const content = draft.trim();
    if (!content || chat.busy) return;
    // The files are already in the workspace, so the message names them.
    const named = attachments.map((attachment) => attachment.path).join(' ');
    chat.send(named ? `${content}

${named}` : content);
    setDraft('');
    setAttachments([]);
  }, [attachments, chat, draft]);

  if (!props.sessionId) {
    return (
      <div className="zx-chat">
        <header className="zx-chat-header">
          <h1 className="zx-chat-agent-name">{props.agentName ?? ''}</h1>
          {props.onOpenPanel ? (
            <button
              type="button"
              className="zx-chat-settings"
              aria-label={t('agentPanel.open')}
              title={t('agentPanel.open')}
              onClick={props.onOpenPanel}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <path d="M14 4v16" />
              </svg>
            </button>
          ) : null}
        </header>
        <div className="zx-chat-empty">
          <p>{t('chat.noSession')}</p>
          {props.onCreateSession ? (
            <button type="button" className="zx-button-primary" onClick={props.onCreateSession}>
              {t('chat.startSession')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="zx-chat"
      data-dropping={dropping ? 'true' : undefined}
      onDragOver={(event) => {
        // A file dropped on the chat goes into the workspace of the agent.
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropping(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropping(false);
        void uploads.add(event.dataTransfer.files);
      }}
    >
      {dropping ? <div className="zx-chat-drop">{t('chat.dropHint')}</div> : null}
      <header className="zx-chat-header">
        <h1 className="zx-chat-agent-name">{props.agentName ?? ''}</h1>
        <div className="zx-chat-tools">
          <input
            className="zx-chat-search"
            type="search"
            value={query}
            placeholder={t('chat.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
          {props.onOpenPanel ? (
            <button type="button" className="zx-chat-settings" onClick={props.onOpenPanel}>
              {t('agentPanel.open')}
            </button>
          ) : null}
        </div>
      </header>
      <div className="zx-chat-list" ref={listRef}>
        {chat.turns.length === 0 ? (
          <p className="zx-chat-empty">{t('chat.empty')}</p>
        ) : visibleTurns.length === 0 ? (
          <p className="zx-chat-empty">{t('chat.noMatch')}</p>
        ) : (
          visibleTurns.map(({ turn, index }) => (
            <ChatTurnRow key={turnKey(turn, index)} turn={turn} onCopy={copyTurn} />
          ))
        )}
        {chat.socket.reconnecting ? <p className="zx-chat-status">{t('chat.reconnecting')}</p> : null}
        {chat.socket.error ? <p className="zx-chat-status" data-tone="error">{chat.socket.error}</p> : null}
      </div>

      <div className="zx-composer">
        <AttachmentPicker attachments={attachments} uploads={uploads} />
        <textarea
          className="zx-composer-input"
          rows={2}
          value={draft}
          placeholder={t('chat.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        {chat.busy ? (
          <button
            type="button"
            className="zx-composer-button"
            aria-label={t('chat.stop')}
            title={t('chat.stop')}
            onClick={chat.stop}
          >
            <span aria-hidden="true">■</span>
          </button>
        ) : (
          <button
            type="button"
            className="zx-composer-button"
            aria-label={t('chat.send')}
            title={t('chat.send')}
            disabled={!draft.trim()}
            onClick={submit}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function turnKey(turn: ChatTurn, index: number): string {
  if (turn.kind === 'message') return turn.message?.id ?? `message-${index}`;
  if (turn.kind === 'tool') return `tool-${turn.tool?.callId ?? index}`;
  return `thinking-${index}`;
}

/** The text a turn carries, for the search and the copy. */
function turnText(turn: ChatTurn): string {
  if (turn.kind === 'thinking') return turn.thinking ?? '';
  if (turn.kind === 'tool') return `${turn.tool?.name ?? ''} ${turn.tool?.result ?? ''}`.trim();
  return stripImageMarkers(turn.message?.content ?? '');
}

function ChatTurnRow(props: { turn: ChatTurn; onCopy: (turn: ChatTurn) => void }) {
  const { t } = useTranslation();
  const { turn } = props;
  if (turn.kind === 'thinking') {
    return (
      <div className="zx-chat-turn zx-chat-turn-thinking">
        <span className="zx-chat-thinking-mark" aria-hidden="true" />
        <span className="zx-chat-thinking-text">{turn.thinking}</span>
      </div>
    );
  }
  if (turn.kind === 'tool') {
    const tool = turn.tool;
    if (!tool) return null;
    return (
      <div className="zx-chat-turn zx-chat-turn-tool" data-status={tool.status}>
        <div className="zx-chat-tool-head">
          <span className="zx-chat-tool-name">{tool.name}</span>
          <span className="zx-chat-tool-status">
            {tool.status === 'running' ? '…' : tool.errorCode ? t('chat.toolFailed') : t('chat.toolDone')}
          </span>
        </div>
        {tool.reasoning ? <p className="zx-chat-tool-reasoning">{tool.reasoning}</p> : null}
        {tool.result ? <pre className="zx-chat-tool-result">{tool.result.slice(0, 600)}</pre> : null}
      </div>
    );
  }
  const message = turn.message;
  if (!message) return null;
  if (message.role === 'tool_call') {
    return (
      <div className="zx-chat-turn zx-chat-turn-tool" data-status={message.toolStatus ?? 'done'}>
        <div className="zx-chat-tool-head">
          <span className="zx-chat-tool-name">{message.toolName ?? 'tool'}</span>
        </div>
        {message.toolResult ? (
          <pre className="zx-chat-tool-result">{message.toolResult.slice(0, 600)}</pre>
        ) : null}
      </div>
    );
  }
  const images = messageImages(message.content);
  const text = stripImageMarkers(message.content);

  if (message.role === 'assistant') {
    return (
      <div className="zx-chat-turn" data-role={message.role}>
        <div className="zx-chat-bubble">
          {images.length > 0 ? (
            <div className="zx-message-images">
              {images.map((image, index) => (
                <img
                  key={index}
                  className="zx-message-image"
                  src={image.src}
                  alt={image.mimeType}
                />
              ))}
            </div>
          ) : null}
          <MarkdownView content={text} />
        </div>
        {text ? (
          <button
            type="button"
            className="zx-chat-copy"
            onClick={() => props.onCopy(turn)}
          >
            {t('chat.copy')}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="zx-chat-turn" data-role={message.role}>
      <div className="zx-chat-bubble">
        {images.length > 0 ? (
          <div className="zx-message-images">
            {images.map((image, index) => (
              <img
                key={index}
                className="zx-message-image"
                src={image.src}
                alt={image.mimeType}
              />
            ))}
          </div>
        ) : null}
        {text}
      </div>
    </div>
  );
}
