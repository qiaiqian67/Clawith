import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  clickAt,
  drag,
  lockSession,
  pressKeys,
  readCurrentUrl,
  takeScreenshot,
  typeText,
  unlockSession,
  type ControlScreenshot,
} from '../../shared/control.ts';
import './take-control.css';

/**
 * Taking over the screen of an assistant.
 *
 * The user sees the screen of the assistant, drives it with the mouse and
 * the keys, and hands it back when they are done. The session is locked
 * while they drive it, so the assistant waits.
 */

export interface TakeControlPanelProps {
  baseUrl: string;
  token: string | null;
  agentId: string;
  /** The session that runs in the browser or on the computer. */
  sessionId: string | null;
}

export function TakeControlPanel(props: TakeControlPanelProps) {
  const { t } = useTranslation();
  const [shot, setShot] = useState<ControlScreenshot | null>(null);
  const [url, setUrl] = useState('');
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  const refresh = useCallback(async () => {
    if (!props.token || !props.sessionId) return;
    const [picture, place] = await Promise.all([
      takeScreenshot(props.baseUrl, props.token, props.agentId, props.sessionId),
      readCurrentUrl(props.baseUrl, props.token, props.agentId, props.sessionId),
    ]);
    setShot(picture);
    setUrl(place?.url ?? '');
  }, [props.agentId, props.baseUrl, props.sessionId, props.token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const take = useCallback(async () => {
    if (!props.token || !props.sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await lockSession(props.baseUrl, props.token, props.agentId, props.sessionId, url || undefined);
      setLocked(true);
      await refresh();
      setNote(t('takeControl.locked'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [props.agentId, props.baseUrl, props.sessionId, props.token, refresh, t, url]);

  const give = useCallback(async () => {
    if (!props.token || !props.sessionId) return;
    setBusy(true);
    try {
      await unlockSession(props.baseUrl, props.token, props.agentId, props.sessionId);
      setLocked(false);
      setNote(t('takeControl.released'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.retry'));
    } finally {
      setBusy(false);
    }
  }, [props.agentId, props.baseUrl, props.sessionId, props.token, t]);

  const at = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!locked || !props.token || !props.sessionId) return;
      const frame = frameRef.current;
      if (!frame || !shot?.width || !shot.height) return;
      const box = frame.getBoundingClientRect();
      const x = Math.round(((event.clientX - box.left) / box.width) * shot.width);
      const y = Math.round(((event.clientY - box.top) / box.height) * shot.height);
      await clickAt(props.baseUrl, props.token, props.agentId, props.sessionId, x, y);
      await refresh();
    },
    [locked, props.agentId, props.baseUrl, props.sessionId, props.token, refresh, shot],
  );

  const dragTo = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!locked || !props.token || !props.sessionId) return;
      const frame = frameRef.current;
      if (!frame || !shot?.width || !shot.height) return;
      const box = frame.getBoundingClientRect();
      const to = {
        x: Math.round(((event.clientX - box.left) / box.width) * shot.width),
        y: Math.round(((event.clientY - box.top) / box.height) * shot.height),
      };
      if (!dragFrom.current) {
        dragFrom.current = to;
        return;
      }
      const from = dragFrom.current;
      dragFrom.current = null;
      await drag(props.baseUrl, props.token, props.agentId, props.sessionId, from, to);
      await refresh();
    },
    [locked, props.agentId, props.baseUrl, props.sessionId, props.token, refresh, shot],
  );

  const type = useCallback(
    async (text: string) => {
      if (!locked || !props.token || !props.sessionId || !text) return;
      await typeText(props.baseUrl, props.token, props.agentId, props.sessionId, text);
      await refresh();
    },
    [locked, props.agentId, props.baseUrl, props.sessionId, props.token, refresh],
  );

  const keys = useCallback(
    async (combination: string[]) => {
      if (!locked || !props.token || !props.sessionId) return;
      await pressKeys(props.baseUrl, props.token, props.agentId, props.sessionId, combination);
      await refresh();
    },
    [locked, props.agentId, props.baseUrl, props.sessionId, props.token, refresh],
  );

  if (!props.sessionId) {
    return <p className="zx-agent-empty">{t('takeControl.noSession')}</p>;
  }

  return (
    <div className="zx-take-control">
      <div className="zx-take-control-bar">
        <span className="zx-take-control-url">{url || t('takeControl.unknownPage')}</span>
        <span className="zx-take-control-state" data-locked={locked ? 'true' : undefined}>
          {locked ? t('takeControl.youDrive') : t('takeControl.assistantDrives')}
        </span>
        {locked ? (
          <button type="button" className="zx-button-ghost" disabled={busy} onClick={() => void give()}>
            {t('takeControl.giveBack')}
          </button>
        ) : (
          <button type="button" className="zx-button-primary" disabled={busy} onClick={() => void take()}>
            {t('takeControl.takeOver')}
          </button>
        )}
        <button type="button" className="zx-button-ghost" disabled={busy} onClick={() => void refresh()}>
          {t('takeControl.refresh')}
        </button>
      </div>

      {note ? <p className="zx-agent-saved">{note}</p> : null}
      {error ? <p className="zx-field-error">{error}</p> : null}

      <div
        ref={frameRef}
        className="zx-take-control-frame"
        data-locked={locked ? 'true' : undefined}
        onMouseDown={(event) => {
          if (event.shiftKey) return;
          void at(event);
        }}
        onMouseUp={(event) => void dragTo(event)}
      >
        {shot?.image ? (
          <img className="zx-take-control-image" src={shot.image} alt={t('takeControl.screen')} />
        ) : (
          <p className="zx-agent-empty">{t('takeControl.noPicture')}</p>
        )}
      </div>

      <div className="zx-take-control-actions">
        <input
          className="zx-field-input"
          placeholder={t('takeControl.typePlaceholder')}
          disabled={!locked}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const value = event.currentTarget.value;
            event.currentTarget.value = '';
            void type(value);
          }}
        />
        <div className="zx-take-control-keys">
          {['Tab', 'Enter', 'Escape', 'ctrl+a'].map((key) => (
            <button
              key={key}
              type="button"
              className="zx-button-ghost"
              disabled={!locked}
              onClick={() => void keys(key === 'ctrl+a' ? ['ctrl', 'a'] : [key])}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
