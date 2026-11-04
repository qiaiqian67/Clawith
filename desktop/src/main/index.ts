import { app, BrowserWindow, ipcMain, Notification, protocol, screen, shell } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

import type {
  AppBootstrap,
  AppPreferences,
  ServerState,
  StoredCredential,
} from '../renderer/src/shared/contract';
import type { HttpRequest, HttpUploadRequest } from '../renderer/src/shared/http-contract';
import { ClientStore, SUGGESTED_SERVER_URL } from './store';
import { performRequest, performUpload } from './http-client';
import { UpdateService } from './update-service';
import { createTray, destroyTray, installMenu, revealWindow } from './tray';

/**
 * The Electron main process of the ZeroX client.
 *
 * The main process owns the window, the store of servers and preferences, and
 * the operating-system adapters. The renderer owns the interface. Neither one
 * reaches into the other's data: the renderer asks through the preload
 * bridge, and every answer is a plain serialisable value.
 */

const CHANNELS = {
  getBootstrap: 'zx:bootstrap',
  getPreferences: 'zx:preferences:get',
  setPreferences: 'zx:preferences:set',
  addServer: 'zx:server:add',
  removeServer: 'zx:server:remove',
  selectServer: 'zx:server:select',
  setCredential: 'zx:credential:set',
  clearCredential: 'zx:credential:clear',
  openExternal: 'zx:shell:openExternal',
  checkForUpdates: 'zx:update:check',
  downloadUpdate: 'zx:update:download',
  requestHttp: 'zx:http',
  uploadFile: 'zx:http:upload',
  notify: 'zx:notify',
  isFocused: 'zx:window:focused',
} as const;

/** Where the window was when the client last closed. */
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

let store: ClientStore | null = null;
let windowBoundsPath = '';
const updateService = new UpdateService();
/** The user asked to quit, so closing the window ends the process. */
let quitting = false;

function requireStore(): ClientStore {
  if (!store) {
    throw new Error('The client store is not ready.');
  }
  return store;
}

/**
 * The scheme the packaged page is served from.
 *
 * A page on `file://` has no origin the renderer can trust: the browser
 * treats it as opaque, and the fuses of the build turn off the extra powers
 * it once had, so a page inside the asar archive is not found at all. A
 * custom `app://` scheme is a standard, secure origin, so the page reads its
 * own files, keeps its own storage, and enforces the policy of `index.html`.
 */
const APP_SCHEME = 'app';
const APP_HOST = 'bundle';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/** The types the packaged page needs. */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Serve the bundle from the asar archive.
 *
 * Every path is resolved and checked against the renderer directory, so a
 * page cannot read a file that is not part of the bundle.
 */
function serveBundle(): void {
  const root = resolve(join(__dirname, '..', 'renderer'));

  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.hostname !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }
    const requested = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const target = resolve(root, requested || 'index.html');
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response('Not found', { status: 404 });
    }
    if (!existsSync(target)) {
      return new Response('Not found', { status: 404 });
    }
    const type = CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream';
    return new Response(readFileSync(target), {
      headers: { 'Content-Type': type },
    });
  });
}

/** The URL the renderer is served from. */
function rendererUrl(): string {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) return devServer;
  return `${APP_SCHEME}://${APP_HOST}/index.html`;
}

/**
 * The place and the size of the window.
 *
 * The window opens where the user left it. A place that is no longer on a
 * screen is dropped, so a window does not open off the edge after a monitor
 * is removed.
 */
function readWindowBounds(): WindowBounds | null {
  if (!existsSync(windowBoundsPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(windowBoundsPath, 'utf-8')) as WindowBounds;
    const display = screen.getDisplayMatching({
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
    });
    const inside =
      parsed.x >= display.bounds.x - 40 &&
      parsed.y >= display.bounds.y - 40 &&
      parsed.x + parsed.width <= display.bounds.x + display.bounds.width + 40 &&
      parsed.y + parsed.height <= display.bounds.y + display.bounds.height + 40;
    return inside ? parsed : null;
  } catch {
    return null;
  }
}

function writeWindowBounds(window: BrowserWindow): void {
  try {
    const maximized = window.isMaximized();
    const bounds = maximized ? window.getNormalBounds() : window.getBounds();
    writeFileSync(windowBoundsPath, JSON.stringify({ ...bounds, maximized }), 'utf-8');
  } catch {
    // The place of the window is a convenience, so a failure costs nothing.
  }
}

function createWindow(): BrowserWindow {
  const remembered = readWindowBounds();
  const window = new BrowserWindow({
    width: remembered?.width ?? 1280,
    height: remembered?.height ?? 820,
    ...(remembered ? { x: remembered.x, y: remembered.y } : {}),
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    title: 'ZeroX',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (remembered?.maximized) {
    window.maximize();
  }

  // The window is shown once the interface has painted, so the user never
  // sees an empty frame.
  window.once('ready-to-show', () => {
    window.show();
  });

  // A link that opens a new window opens the browser instead.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // The renderer never navigates away from its own page.
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl()) {
      event.preventDefault();
    }
  });

  // Closing the window hides the client in the tray, so an assistant can
  // still reach the user. The user quits from the tray or the menu.
  window.on('close', (event) => {
    writeWindowBounds(window);
    if (quitting) return;
    event.preventDefault();
    window.hide();
  });

  void window.loadURL(rendererUrl());
  return window;
}

function registerChannels(): void {
  ipcMain.handle(CHANNELS.getBootstrap, (): AppBootstrap => {
    const current = requireStore();
    const serverState = current.getServerState();
    const active = serverState.active;
    return {
      appVersion: app.getVersion(),
      platform: process.platform as AppBootstrap['platform'],
      preferences: current.getPreferences(),
      serverState,
      credential: active ? current.getCredential(active.id) : null,
      suggestedServerUrl: SUGGESTED_SERVER_URL,
    };
  });

  ipcMain.handle(CHANNELS.getPreferences, (): AppPreferences => requireStore().getPreferences());

  ipcMain.handle(
    CHANNELS.setPreferences,
    (_event, update: Partial<AppPreferences>): AppPreferences =>
      requireStore().setPreferences(update ?? {}),
  );

  ipcMain.handle(CHANNELS.addServer, (_event, url: string, name?: string): ServerState =>
    requireStore().addServer(url, name),
  );

  ipcMain.handle(CHANNELS.removeServer, (_event, serverId: string): ServerState =>
    requireStore().removeServer(serverId),
  );

  ipcMain.handle(CHANNELS.selectServer, (_event, serverId: string): ServerState =>
    requireStore().selectServer(serverId),
  );

  ipcMain.handle(CHANNELS.setCredential, (_event, credential: StoredCredential): void => {
    requireStore().setCredential(credential);
  });

  ipcMain.handle(CHANNELS.clearCredential, (): void => {
    const current = requireStore();
    const active = current.getServerState().active;
    if (active) {
      current.clearCredential(active.id);
    }
  });

  ipcMain.handle(CHANNELS.openExternal, (_event, url: string): void => {
    if (!/^https?:\/\//i.test(url)) {
      return;
    }
    void shell.openExternal(url);
  });

  ipcMain.handle(CHANNELS.checkForUpdates, () => updateService.check());
  ipcMain.handle(CHANNELS.downloadUpdate, () => updateService.download());
  ipcMain.handle(CHANNELS.requestHttp, (_event, request: HttpRequest) => performRequest(request));
  ipcMain.handle(CHANNELS.uploadFile, (_event, request: HttpUploadRequest) => performUpload(request));

  // A notification reaches the user while the window is hidden in the tray,
  // which is where the window goes when it is closed.
  ipcMain.handle(CHANNELS.notify, (_event, request: { title: string; body: string }): void => {
    if (!request || typeof request.body !== 'string') return;
    if (!Notification.isSupported()) return;
    const notice = new Notification({
      title: typeof request.title === 'string' ? request.title : 'ZeroX',
      body: request.body.slice(0, 500),
      silent: false,
    });
    notice.on('click', () => {
      revealWindow(BrowserWindow.getAllWindows(), createWindow);
    });
    notice.show();
  });

  ipcMain.handle(CHANNELS.isFocused, (): boolean =>
    BrowserWindow.getAllWindows().some((window) => window.isFocused() && window.isVisible()),
  );
}

// A second launch brings the window of the first forward instead of starting
// a second copy, so two clients never work on one store.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

void app.whenReady().then(() => {
  app.on('second-instance', () => {
    revealWindow(BrowserWindow.getAllWindows(), createWindow);
  });

  serveBundle();
  const userData = app.getPath('userData');
  windowBoundsPath = join(userData, 'window-bounds.json');
  store = new ClientStore(userData);
  store.prepare();
  registerChannels();
  installMenu();
  const window = createWindow();

  // The tray keeps the client one click away while the window is hidden.
  createTray(
    () => revealWindow(BrowserWindow.getAllWindows(), createWindow),
    () => {
      quitting = true;
      app.quit();
    },
  );

  app.on('activate', () => {
    revealWindow(BrowserWindow.getAllWindows(), createWindow);
  });

  app.on('before-quit', () => {
    quitting = true;
    if (window && !window.isDestroyed()) {
      writeWindowBounds(window);
    }
    destroyTray();
  });
});

app.on('window-all-closed', () => {
  // The client lives in the tray on every platform, so closing the window
  // does not end the process. The tray menu quits it.
});
