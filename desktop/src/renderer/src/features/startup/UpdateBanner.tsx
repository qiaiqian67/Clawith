import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { desktopApi } from '../../shared/bridge';
import type { UpdateState } from '../../shared/contract';
import './update-banner.css';

/**
 * The banner of a new release.
 *
 * The check runs once, when the workspace opens. The banner offers the
 * download, and the main process installs the new build on the next start.
 */

export function UpdateBanner() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const api = desktopApi();
    if (!api) return;
    try {
      const result = await api.checkForUpdates();
      if (result.available) {
        setState(result);
      }
    } catch {
      // The feed is not there, or the network is gone. The client works
      // without an update.
    }
  }, []);

  useEffect(() => {
    // The check is a request to the main process, so the state changes when
    // the answer arrives and not while the effect runs.
    const timer = window.setTimeout(() => void check(), 0);
    return () => window.clearTimeout(timer);
  }, [check]);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      const result = await desktopApi()?.downloadUpdate();
      if (result?.available) {
        setState(result);
      }
    } catch {
      // The download did not finish. The banner stays, so the user can try
      // again.
    } finally {
      setBusy(false);
    }
  }, []);

  if (!state?.available) {
    return null;
  }

  return (
    <div className="zx-update-banner" role="status">
      <span className="zx-update-text">
        {t('update.available', { version: state.version ?? '' })}
      </span>
      <button type="button" className="zx-update-button" disabled={busy} onClick={() => void download()}>
        {busy ? t('update.downloading') : t('update.download')}
      </button>
    </div>
  );
}
