/**
 * The contract between the renderer and the Electron main process.
 *
 * Every value that crosses the bridge is declared here. The preload builds
 * the bridge from these names, and the renderer calls it through the typed
 * shape at the bottom of this file, so a channel that changes name is a
 * compile error in both places instead of a runtime rejection nobody sees.
 */

/** One server the user can sign in to. */
export interface ServerSummary {
  /** Stable identity of the server entry on this computer. */
  id: string;
  /** The address the user typed, without a trailing slash. */
  url: string;
  /** The name the user gave it, or the host name when they gave none. */
  name: string;
  /** The last known state of the connection to this server. */
  state: 'online' | 'offline' | 'connecting' | 'unknown';
}

/** The connection state of the server the client is pointed at. */
export interface ServerState {
  /** The server the client talks to now. */
  active: ServerSummary | null;
  /** Every server the user has added. */
  servers: ServerSummary[];
}

/** One credential the client keeps for a server. */
export interface StoredCredential {
  serverId: string;
  /** The signed-in user id, when the credential belongs to a user. */
  userId: string | null;
  /** The access token, when one is held. */
  accessToken: string | null;
  /** The display name of the signed-in user. */
  displayName: string | null;
}

/** The preference the client keeps on this computer. */
export interface AppPreferences {
  /** The interface language, as a language tag such as `zh` or `en`. */
  language: string;
  /** The window theme the user chose. */
  theme: 'dark' | 'light' | 'system';
  /** The server the client opens with. */
  activeServerId: string | null;
  /** Whether the first-run flow already finished. */
  onboardingCompleted: boolean;
}

/** The full state the renderer reads at start. */
export interface AppBootstrap {
  appVersion: string;
  platform: 'darwin' | 'win32' | 'linux';
  preferences: AppPreferences;
  serverState: ServerState;
  /** The signed-in user of the active server, when there is one. */
  credential: StoredCredential | null;
  /** The address a new installation suggests, so the first screen can offer it. */
  suggestedServerUrl: string;
}

import type { HttpRequest, HttpResponse, HttpUploadRequest } from './http-contract';

/** The API the preload exposes on `window.zerox`. */
export interface ZeroXDesktopApi {
  /** Read the whole start state in one call. */
  getBootstrap(): Promise<AppBootstrap>;
  /** Read the stored preferences. */
  getPreferences(): Promise<AppPreferences>;
  /** Write the stored preferences. A partial update changes only the named fields. */
  setPreferences(update: Partial<AppPreferences>): Promise<AppPreferences>;
  /** Add a server, or update the address of one that already exists. */
  addServer(url: string, name?: string): Promise<ServerState>;
  /** Remove a server. The credential of that server goes with it. */
  removeServer(serverId: string): Promise<ServerState>;
  /** Point the client at one server. */
  selectServer(serverId: string): Promise<ServerState>;
  /** Store the credential of the active server. */
  setCredential(credential: StoredCredential): Promise<void>;
  /** Drop the credential of the active server. */
  clearCredential(): Promise<void>;
  /** Open a URL in the user's browser, not in the app. */
  openExternal(url: string): Promise<void>;
  /** Check for a new release of the client. */
  checkForUpdates(): Promise<UpdateState>;
  /** Download the new release, if there is one. */
  downloadUpdate(): Promise<UpdateState>;
  /**
   * Perform one request to the server.
   *
   * The main process has no origin, so the call reaches any server the user
   * configured. A page on `app://` that called the server itself would be a
   * cross-origin call the server would have to allow.
   */
  requestHttp(request: HttpRequest): Promise<HttpResponse>;
  /** Upload one file to the server. */
  uploadFile(request: HttpUploadRequest): Promise<HttpResponse>;
  /**
   * Tell the user that something happened while the window was away.
   *
   * The operating system shows it, so an answer reaches the user when the
   * window is hidden in the tray.
   */
  notify(request: { title: string; body: string }): Promise<void>;
  /** Whether the window has the focus of the user. */
  isFocused(): Promise<boolean>;
}

/** The state of the release feed. */
export interface UpdateState {
  /** A newer build is there. */
  available: boolean;
  /** The version of the newer build. */
  version: string | null;
  /** The failure of the last check, when there was one. */
  error?: string | null;
}
