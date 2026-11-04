import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './features/startup/ErrorBoundary';
import './i18n';
import './styles/tokens.css';
import './styles/appearance.css';
import './styles/base.css';
import './styles/view.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('The client has no root element to mount into.');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
