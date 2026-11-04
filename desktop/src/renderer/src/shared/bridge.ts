import type {
  AppPreferences,
  AppBootstrap,
  ServerState,
  StoredCredential,
  ZeroXDesktopApi,
} from './contract';

/**
 * The bridge to the Electron main process.
 *
 * In development the page runs inside Electron, so the bridge is there. In a
 * browser without Electron the bridge is absent, and the client runs against
 * the default server with a token kept in the page. That fallback exists for
 * the interface work; the packaged client always has the bridge.
 */
declare global {
  interface Window {
    zerox?: ZeroXDesktopApi;
  }
}

export function desktopApi(): ZeroXDesktopApi | null {
  return typeof window === 'undefined' ? null : (window.zerox ?? null);
}

/** The address of the server the client talks to. */
export function activeServerUrl(state: ServerState): string {
  return state.active?.url ?? 'http://localhost:8000';
}

/** The base URL of the API on that server. */
export function apiBaseUrl(state: ServerState): string {
  return `${activeServerUrl(state)}/api`;
}

/** The URL of the chat socket on that server. */
export function websocketUrl(state: ServerState, agentId: string, token: string): string {
  const base = activeServerUrl(state);
  const scheme = base.startsWith('https://') ? 'wss:' : 'ws:';
  const host = base.replace(/^https?:\/\//i, '');
  return `${scheme}//${host}/ws/chat/${agentId}?token=${encodeURIComponent(token)}`;
}

export const DEFAULT_BOOTSTRAP: AppBootstrap = {
  appVersion: '0.0.0',
  platform: 'linux',
  preferences: {
    language: 'zh',
    theme: 'system',
    activeServerId: null,
    onboardingCompleted: false,
  },
  serverState: { active: null, servers: [] },
  credential: null,
  suggestedServerUrl: 'http://localhost:8000',
};

export type { AppBootstrap, AppPreferences, ServerState, StoredCredential, ZeroXDesktopApi };
