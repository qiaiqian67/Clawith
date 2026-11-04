import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TeamMark } from '../onboarding/TeamMark';
import './startup-splash.css';

/**
 * The splash while the client opens.
 *
 * The team from the first-run screen stands in the same arc and jumps in a
 * slow wave, one after the other. The scribble under the team fills with the
 * work that is left.
 */

export interface StartupSplashProps {
  /** The app is ready: the splash fades out. */
  ready: boolean;
  /** The work that is left, from 0 to 1. */
  progress: number | null;
  onExited?: () => void;
}

export function StartupSplash(props: StartupSplashProps) {
  const { t } = useTranslation();
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (!props.ready) return;
    const timer = window.setTimeout(() => {
      setExited(true);
      props.onExited?.();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [props]);

  if (exited) {
    return null;
  }

  const percent = props.progress === null ? null : Math.min(100, Math.max(0, props.progress));

  return (
    <div className="zx-splash" data-ready={props.ready ? 'true' : undefined}>
      <div className="zx-splash-stage">
        <TeamMark />

        <div
          className="zx-splash-progress"
          role="progressbar"
          aria-label={t('splash.opening')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          data-known={percent === null ? 'false' : 'true'}
          style={{ '--zx-splash-percent': String((percent ?? 0) / 100) } as React.CSSProperties}
        >
          <svg className="zx-splash-scribble" viewBox="0 0 112 14" aria-hidden="true">
            <polyline
              className="zx-splash-track"
              points="3 10 10 4 13 10 21 4 24 10 32 4 35 10 43 4 46 10 54 4 57 10 65 4 68 10 76 4 79 10 87 4 90 10 98 4 101 10 109 4"
              pathLength="1"
            />
            <polyline
              className="zx-splash-fill"
              points="3 10 10 4 13 10 21 4 24 10 32 4 35 10 43 4 46 10 54 4 57 10 65 4 68 10 76 4 79 10 87 4 90 10 98 4 101 10 109 4"
              pathLength="1"
            />
          </svg>
        </div>

        <p className="zx-splash-label" role="status">
          {t('splash.opening')}
        </p>
      </div>
    </div>
  );
}
