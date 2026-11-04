import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { hostNameOf, normalizeServerUrl } from './server-url';

import type {
  AppPreferences,
  ServerState,
  ServerSummary,
  StoredCredential,
} from '../renderer/src/shared/contract';

/**
 * The store of everything the client keeps on this computer.
 *
 * One file holds the servers and the preferences. One file per server holds
 * that server's credential, encrypted with the operating system key store.
 * The credential never enters the plain store, so a backup of the plain file
 * carries no session.
 */

/**
 * The address a new installation suggests.
 *
 * It is a suggestion, not a server: a client that shipped with a server it
 * cannot reach would fail at the first call and never say why. The first
 * screen asks for the address instead.
 */
export const SUGGESTED_SERVER_URL = 'http://localhost:8000';

interface ServerRecord {
  id: string;
  url: string;
  name: string;
  state: 'online' | 'offline' | 'connecting' | 'unknown';
}

interface PlainStore {
  version: 1;
  preferences: AppPreferences;
  servers: ServerRecord[];
  activeServerId: string | null;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'zh',
  theme: 'system',
  activeServerId: null,
  onboardingCompleted: false,
};

function emptyStore(): PlainStore {
  return {
    version: 1,
    preferences: { ...DEFAULT_PREFERENCES },
    servers: [],
    activeServerId: null,
  };
}

export class ClientStore {
  private readonly plainPath: string;
  private readonly credentialDirectory: string;
  private plain: PlainStore;

  constructor(userDataPath: string) {
    this.plainPath = join(userDataPath, 'zerox-store.json');
    this.credentialDirectory = join(userDataPath, 'credentials');
    // The directory of the credentials must exist before the first sign-in,
    // or the first session of a new installation cannot be saved.
    mkdirSync(this.credentialDirectory, { recursive: true });
    this.plain = this.readPlain();
  }

  private readPlain(): PlainStore {
    if (!existsSync(this.plainPath)) {
      return emptyStore();
    }
    try {
      const parsed = JSON.parse(readFileSync(this.plainPath, 'utf-8')) as Partial<PlainStore>;
      if (!parsed || parsed.version !== 1) {
        return emptyStore();
      }
      return {
        version: 1,
        preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) },
        servers: Array.isArray(parsed.servers) ? parsed.servers : [],
        activeServerId: parsed.activeServerId ?? null,
      };
    } catch {
      // A store that cannot be read is a store the user has not configured yet.
      // Losing it costs a sign-in, not data.
      return emptyStore();
    }
  }

  private writePlain(): void {
    writeFileSync(this.plainPath, JSON.stringify(this.plain, null, 2), 'utf-8');
  }

  private credentialPath(serverId: string): string {
    return join(this.credentialDirectory, `${serverId}.bin`);
  }

  getPreferences(): AppPreferences {
    return { ...this.plain.preferences };
  }

  setPreferences(update: Partial<AppPreferences>): AppPreferences {
    this.plain.preferences = { ...this.plain.preferences, ...update };
    this.writePlain();
    return this.getPreferences();
  }

  getServerState(): ServerState {
    const servers: ServerSummary[] = this.plain.servers.map((server) => ({
      id: server.id,
      url: server.url,
      name: server.name,
      state: server.state,
    }));
    const activeId = this.plain.activeServerId;
    const active = servers.find((server) => server.id === activeId) ?? null;
    return { active, servers };
  }

  addServer(rawUrl: string, name?: string): ServerState {
    const url = normalizeServerUrl(rawUrl);
    const existing = this.plain.servers.find((server) => server.url === url);
    if (existing) {
      if (name) {
        existing.name = name;
      }
      this.plain.activeServerId = existing.id;
      this.writePlain();
      return this.getServerState();
    }
    const id = randomUUID();
    this.plain.servers.push({
      id,
      url,
      name: (name ?? '').trim() || hostNameOf(url),
      state: 'unknown',
    });
    this.plain.activeServerId = id;
    this.writePlain();
    return this.getServerState();
  }

  removeServer(serverId: string): ServerState {
    const index = this.plain.servers.findIndex((server) => server.id === serverId);
    if (index === -1) {
      return this.getServerState();
    }
    this.plain.servers.splice(index, 1);
    if (this.plain.activeServerId === serverId) {
      this.plain.activeServerId = this.plain.servers[0]?.id ?? null;
    }
    this.writePlain();
    this.clearCredential(serverId);
    return this.getServerState();
  }

  selectServer(serverId: string): ServerState {
    if (!this.plain.servers.some((server) => server.id === serverId)) {
      throw new Error('That server is not on this computer.');
    }
    this.plain.activeServerId = serverId;
    this.writePlain();
    return this.getServerState();
  }

  setCredential(credential: StoredCredential): void {
    const payload = JSON.stringify(credential);
    const path = this.credentialPath(credential.serverId);
    mkdirSync(this.credentialDirectory, { recursive: true });
    if (safeStorage.isEncryptionAvailable()) {
      // The ciphertext is bytes, so it is written as bytes: a text encoding
      // replaces every sequence that is not valid text, and the result cannot
      // be decrypted.
      writeFileSync(path, encrypt(payload));
      return;
    }
    // No key store on this computer. The file stays in the user data directory
    // with owner-only permissions, and it holds no more than a session token.
    writeFileSync(path, payload, { encoding: 'utf-8', mode: 0o600 });
  }

  getCredential(serverId: string): StoredCredential | null {
    const path = this.credentialPath(serverId);
    if (!existsSync(path)) {
      return null;
    }
    try {
      const raw = readFileSync(path);
      if (safeStorage.isEncryptionAvailable() && isEncrypted(raw)) {
        return JSON.parse(safeStorage.decryptString(raw.subarray(1))) as StoredCredential;
      }
      return JSON.parse(raw.toString('utf-8')) as StoredCredential;
    } catch {
      // A file that cannot be read is a session the user signs in for again,
      // not a file that blocks the client.
      return null;
    }
  }

  clearCredential(serverId?: string): void {
    const targets =
      serverId === undefined
        ? this.plain.servers.map((server) => server.id)
        : [serverId];
    for (const id of targets) {
      const path = this.credentialPath(id);
      if (existsSync(path)) {
        rmSync(path, { force: true });
      }
    }
  }

  /**
   * Prepare the store for the start of the client.
   *
   * A new installation keeps no server, so the client asks for the address
   * before it asks for a password.
   */
  prepare(): void {
    if (this.plain.servers.length === 0) {
      this.plain.activeServerId = null;
      this.writePlain();
    }
  }
}

export function appVersion(): string {
  return app.getVersion();
}

/**
 * The ciphertext of one credential.
 *
 * The first byte says the file is encrypted, so a build without a key store
 * reads the plain files it wrote and not the encrypted ones it cannot.
 */
function encrypt(payload: string): Buffer {
  return Buffer.concat([Buffer.from([1]), safeStorage.encryptString(payload)]);
}

/** Whether a credential file carries ciphertext. */
function isEncrypted(raw: Buffer): boolean {
  return raw.length > 1 && raw[0] === 1;
}
