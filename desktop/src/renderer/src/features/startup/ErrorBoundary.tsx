import React from 'react';
import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../brand/AppLogo';
import './error-boundary.css';

/**
 * The boundary of the interface.
 *
 * A crash in one screen must not leave the user with a white window. The
 * boundary catches it, shows what happened, and offers a way out.
 */

export interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[zerox] the interface crashed', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return <ErrorScreen error={error} onReset={this.reset} onReload={this.reload} />;
  }
}

function ErrorScreen(props: { error: Error; onReset: () => void; onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="zx-error-screen">
      <div className="zx-error-shell">
        <AppLogo />
        <h1 className="zx-error-title">{t('error.title')}</h1>
        <p className="zx-error-text">{t('error.subtitle')}</p>
        <pre className="zx-error-detail">{props.error.message}</pre>
        <div className="zx-error-actions">
          <button type="button" className="zx-button-primary" onClick={props.onReload}>
            {t('error.reload')}
          </button>
          <button type="button" className="zx-button-ghost" onClick={props.onReset}>
            {t('error.tryAgain')}
          </button>
        </div>
      </div>
    </main>
  );
}
