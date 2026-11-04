import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { onSessionExpired } from '../../shared/http';
import { checkServer } from '../../shared/server-reach';
import './offline-banner.css';

/**
 * The connection to the server, as the interface shows it.
 *
 * The client keeps working while the server is away: the chat is local to the
 * screen, and the socket retries on its own. This banner says that the
 * connection is down, and offers the one action that helps.
 */

export interface OfflineBannerProps {
  /** The address of the server the client talks to. */
  serverUrl: string;
}

export function OfflineBanner(props: OfflineBannerProps) {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const reach = await checkServer(props.serverUrl);
    setOffline(reach === 'offline');
    setChecking(false);
  }, [props.serverUrl]);

  useEffect(() => {
    // The first check runs after the first paint, and then on a slow clock
    // while the connection is down.
    const first = window.setTimeout(() => void check(), 0);
    return () => window.clearTimeout(first);
  }, [check]);

  useEffect(() => {
    if (!offline) return;
    const timer = window.setInterval(() => void check(), 15000);
    return () => window.clearInterval(timer);
  }, [check, offline]);

  // A request that answered 401 says the session is gone, not the server.
  useEffect(() => onSessionExpired(() => setOffline(false)), []);

  if (!offline) {
    return null;
  }

  return (
    <div className="zx-offline-banner" role="status">
      <span className="zx-offline-text">{t('offline.banner')}</span>
      <button type="button" className="zx-offline-button" disabled={checking} onClick={() => void check()}>
        {t('offline.retry')}
      </button>
    </div>
  );
}
