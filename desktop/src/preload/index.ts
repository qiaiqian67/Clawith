import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppBootstrap,
  AppPreferences,
  ServerState,
  StoredCredential,
  UpdateState,
  ZeroXDesktopApi,
} from '../renderer/src/shared/contract';
import type {
  HttpRequest,
  HttpResponse,
  HttpUploadRequest,
} from '../renderer/src/shared/http-contract';

/**
 * The only channel the renderer uses.
 *
 * The bridge carries no business rule. It maps a typed call to a channel and
 * hands the answer back unchanged, so the main process stays the one owner of
 * every fact that crosses the boundary.
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

const api: ZeroXDesktopApi = {
  getBootstrap: (): Promise<AppBootstrap> => ipcRenderer.invoke(CHANNELS.getBootstrap),
  getPreferences: (): Promise<AppPreferences> => ipcRenderer.invoke(CHANNELS.getPreferences),
  setPreferences: (update: Partial<AppPreferences>): Promise<AppPreferences> =>
    ipcRenderer.invoke(CHANNELS.setPreferences, update),
  addServer: (url: string, name?: string): Promise<ServerState> =>
    ipcRenderer.invoke(CHANNELS.addServer, url, name),
  removeServer: (serverId: string): Promise<ServerState> =>
    ipcRenderer.invoke(CHANNELS.removeServer, serverId),
  selectServer: (serverId: string): Promise<ServerState> =>
    ipcRenderer.invoke(CHANNELS.selectServer, serverId),
  setCredential: (credential: StoredCredential): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.setCredential, credential),
  clearCredential: (): Promise<void> => ipcRenderer.invoke(CHANNELS.clearCredential),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(CHANNELS.openExternal, url),
  checkForUpdates: (): Promise<UpdateState> => ipcRenderer.invoke(CHANNELS.checkForUpdates),
  downloadUpdate: (): Promise<UpdateState> => ipcRenderer.invoke(CHANNELS.downloadUpdate),
  requestHttp: (request: HttpRequest): Promise<HttpResponse> =>
    ipcRenderer.invoke(CHANNELS.requestHttp, request),
  uploadFile: (request: HttpUploadRequest): Promise<HttpResponse> =>
    ipcRenderer.invoke(CHANNELS.uploadFile, request),
  notify: (request: { title: string; body: string }): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.notify, request),
  isFocused: (): Promise<boolean> => ipcRenderer.invoke(CHANNELS.isFocused),
};

contextBridge.exposeInMainWorld('zerox', api);
