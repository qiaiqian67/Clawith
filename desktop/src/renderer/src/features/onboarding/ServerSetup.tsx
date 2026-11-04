import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { checkServer, type ServerReach } from '../../shared/server-reach';
import './server-setup.css';

/**
 * The first screen of a new installation: the address of the server.
 *
 * Without this screen the client would only ever talk to a server on the
 * same computer, so the user could not use it at all.
 */

export interface ServerSetupProps {
  /** The address that is suggested, such as the one of a first run. */
  suggestion?: string;
  /** The address the client already knows. */
  initialUrl?: string;
  /** The server was reached and the client can go on. */
  onConnect: (url: string) => void;
  /** The user wants to use a server that is not reachable from here. */
  onSkip?: () => void;
}

export function ServerSetup(props: ServerSetupProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(props.initialUrl ?? props.suggestion ?? '');
  const [reach, setReach] = useState<ServerReach | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setReach('offline');
      return;
    }
    setChecking(true);
    setReach('checking');
    const result = await checkServer(trimmed);
    setReach(result);
    setChecking(false);
  }, [url]);

  useEffect(() => {
    const timer = window.setTimeout(() => void check(), 400);
    return () => window.clearTimeout(timer);
  }, [check]);

  return (
    <main className="zx-server-setup">
      <div className="zx-server-setup-shell">
        <h1 className="zx-server-setup-title">{t('serverSetup.title')}</h1>
        <p className="zx-server-setup-subtitle">{t('serverSetup.subtitle')}</p>

        <label className="zx-server-setup-field">
          <span className="zx-field-label">{t('serverSetup.address')}</span>
          <input
            className="zx-field-input"
            type="url"
            autoFocus
            placeholder="https://zerox.example.com"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setReach(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void check();
            }}
          />
        </label>

        {reach === 'offline' ? (
          <p className="zx-server-setup-status" data-tone="error">
            {t('serverSetup.unreachable')}
          </p>
        ) : null}
        {reach === 'online' ? (
          <p className="zx-server-setup-status" data-tone="ok">
            {t('serverSetup.reachable')}
          </p>
        ) : null}

        <div className="zx-server-setup-actions">
          <button
            type="button"
            className="zx-button-primary"
            disabled={checking || !url.trim()}
            onClick={() => {
              if (reach === 'online') {
                props.onConnect(url.trim());
                return;
              }
              void check();
            }}
          >
            {checking ? t('common.loading') : reach === 'online' ? t('serverSetup.connect') : t('serverSetup.check')}
          </button>
          {props.onSkip ? (
            <button type="button" className="zx-button-ghost" onClick={props.onSkip}>
              {t('serverSetup.later')}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
